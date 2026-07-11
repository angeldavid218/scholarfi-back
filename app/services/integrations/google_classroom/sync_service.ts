import Task from '#models/task'
import db from '@adonisjs/lucid/services/db'
import { issueRewardForSubmission } from '#services/credits/reward_issuance_service'
import { getTeacherCreditPoolSummary } from '#services/credits/teacher_credit_pool_service'
import { InsufficientTeacherCreditsError } from '#services/credits/types'
import googleClassroomConfig from '#config/google_classroom'
import {
  buildClassroomGradeByEmailMap,
} from '#services/integrations/google_classroom/client'
import {
  gcLogDebug,
  gcLogError,
  gcLogInfo,
  gcLogWarn,
  type GoogleClassroomLogContext,
} from '#services/integrations/google_classroom/logger'
import {
  getTeacherRefreshToken,
  markTeacherIntegrationSynced,
} from '#services/integrations/google_classroom/oauth_service'
import { ensureClassroomTaskGroupSubmissions } from '#services/integrations/google_classroom/roster_submission_service'
import type {
  GoogleClassroomSyncMetadata,
  GoogleClassroomSyncResult,
} from '#services/integrations/google_classroom/types'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'

type SubmissionRow = {
  id: number
  student_id: number
  status: string
  submitted_at: Date
  email: string
}

type SyncSkipReason =
  | 'already_rewarded'
  | 'no_grade'
  | 'grade_below_minimum'
  | 'budget_exhausted'

function isClassroomTask(task: Task): boolean {
  return task.externalSource === 'google_classroom' && Boolean(task.externalId)
}

function parseSyncMetadata(task: Task): GoogleClassroomSyncMetadata {
  let raw = task.syncMetadata as GoogleClassroomSyncMetadata | string | null
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as GoogleClassroomSyncMetadata
    } catch {
      raw = null
    }
  }

  if (!raw?.courseId || !raw?.courseWorkId || raw.minGrade == null) {
    throw new Error('Task is missing Google Classroom sync metadata')
  }
  return raw
}

async function submissionAlreadyRewarded(submissionId: number): Promise<boolean> {
  const row = await db
    .from('teacher_credit_entries')
    .where('submission_id', submissionId)
    .andWhere('entry_type', 'reward_issue')
    .first()
  return Boolean(row)
}

function logCtx(
  input: { taskId: number; teacherId: number; institutionId: number; requestId?: string },
  syncRunId: string,
  metadata?: GoogleClassroomSyncMetadata
): GoogleClassroomLogContext {
  return {
    requestId: input.requestId,
    syncRunId,
    taskId: input.taskId,
    teacherId: input.teacherId,
    institutionId: input.institutionId,
    courseId: metadata?.courseId,
    courseWorkId: metadata?.courseWorkId,
  }
}

export async function syncGoogleClassroomTask(input: {
  taskId: number
  teacherId: number
  institutionId: number
  requestId?: string
}): Promise<GoogleClassroomSyncResult> {
  const syncRunId = randomUUID()
  let ctx: GoogleClassroomLogContext = logCtx(input, syncRunId)

  gcLogInfo('Classroom sync started', ctx, {
    mockMode: googleClassroomConfig.mockMode,
  })

  try {
    const task = await Task.query()
      .where('id', input.taskId)
      .andWhere('institution_id', input.institutionId)
      .andWhere('created_by_teacher_id', input.teacherId)
      .firstOrFail()

    if (!isClassroomTask(task)) {
      throw new Error('Task is not linked to Google Classroom')
    }

    const metadata = parseSyncMetadata(task)
    ctx = logCtx(input, syncRunId, metadata)

    gcLogInfo('Classroom sync task resolved', ctx, {
      taskTitle: task.title,
      externalId: task.externalId,
      rewardAmount: Number(task.rewardAmount),
      minGrade: metadata.minGrade,
      maxPoints: metadata.maxPoints,
      groupId: task.groupId,
    })

    const rosterSubmissionsCreated = await ensureClassroomTaskGroupSubmissions({
      institutionId: input.institutionId,
      taskId: task.id,
      groupId: task.groupId,
    })

    if (rosterSubmissionsCreated > 0) {
      gcLogInfo('Created pending submissions for linked classroom roster', ctx, {
        rosterSubmissionsCreated,
        groupId: task.groupId,
      })
    }

    const refreshToken = await getTeacherRefreshToken(input.teacherId)
    if (!refreshToken) {
      gcLogWarn('Classroom sync aborted: teacher not connected', ctx)
      throw new Error('Teacher has not connected Google Classroom')
    }

    gcLogDebug('Classroom refresh token loaded for teacher', ctx)

    gcLogInfo('Fetching student submissions from Google Classroom', ctx)
    const gradeByEmail = await buildClassroomGradeByEmailMap({
      refreshToken,
      courseId: metadata.courseId,
      courseWorkId: metadata.courseWorkId,
      logCtx: ctx,
    })

    gcLogInfo('Google Classroom grades loaded (by email)', ctx, {
      gradeEntryCount: gradeByEmail.size,
      gradeKeys: [...gradeByEmail.keys()],
      grades: Object.fromEntries(gradeByEmail.entries()),
    })

    const scholarfiSubmissions = (await db
      .from('submissions')
      .innerJoin('users', 'users.id', 'submissions.student_id')
      .where('submissions.task_id', task.id)
      .andWhere('submissions.institution_id', input.institutionId)
      .orderBy('submissions.submitted_at', 'asc')
      .select(
        'submissions.id as id',
        'submissions.student_id as student_id',
        'submissions.status as status',
        'submissions.submitted_at as submitted_at',
        'users.email as email'
      )) as SubmissionRow[]

    gcLogInfo('ScholarFi submissions loaded (FIFO order)', ctx, {
      scholarfiSubmissionCount: scholarfiSubmissions.length,
      queue: scholarfiSubmissions.map((row, index) => ({
        position: index + 1,
        submissionId: row.id,
        studentId: row.student_id,
        email: row.email,
        submittedAt: row.submitted_at,
        status: row.status,
      })),
    })

    const result: GoogleClassroomSyncResult = {
      taskId: task.id,
      rewarded: 0,
      skippedNoSubmission: 0,
      skippedLowGrade: 0,
      skippedNoGrade: 0,
      skippedAlreadyRewarded: 0,
      skippedBudgetExhausted: 0,
      budgetRemaining: 0,
      rewardedSubmissionIds: [],
    }

    let pool = await getTeacherCreditPoolSummary(input.teacherId)
    const rewardAmount = Number(task.rewardAmount)

    gcLogInfo('Teacher credit pool at sync start', ctx, {
      hasPool: pool?.hasPool ?? false,
      allocatedCredits: pool?.allocatedCredits ?? 0,
      utilizedCredits: pool?.utilizedCredits ?? 0,
      remainingCredits: pool?.remainingCredits ?? 0,
      rewardAmountPerStudent: rewardAmount,
    })

    for (const [index, submission] of scholarfiSubmissions.entries()) {
      const userKey = submission.email.trim().toLowerCase()
      const grade = gradeByEmail.get(userKey)
      const gradeFound = gradeByEmail.has(userKey)

      gcLogDebug('Evaluating submission for Classroom sync', ctx, {
        position: index + 1,
        submissionId: submission.id,
        studentId: submission.student_id,
        email: submission.email,
        lookupKey: userKey,
        gradeFound,
        grade: grade ?? null,
        minGrade: metadata.minGrade,
      })

      await db
        .from('submissions')
        .where('id', submission.id)
        .update({
          external_grade: grade ?? null,
          grade_checked_at: new Date(),
          updated_at: new Date(),
        })

      let skipReason: SyncSkipReason | null = null

      if (await submissionAlreadyRewarded(submission.id)) {
        result.skippedAlreadyRewarded += 1
        skipReason = 'already_rewarded'
      } else if (grade == null) {
        result.skippedNoGrade += 1
        skipReason = 'no_grade'
      } else if (grade < metadata.minGrade) {
        result.skippedLowGrade += 1
        skipReason = 'grade_below_minimum'
      } else if (!pool || pool.remainingCredits < rewardAmount || rewardAmount <= 0) {
        result.skippedBudgetExhausted += 1
        skipReason = 'budget_exhausted'
      }

      if (skipReason) {
        await db
          .from('submissions')
          .where('id', submission.id)
          .update({ reward_skipped_reason: skipReason })

        gcLogInfo('Submission skipped during Classroom sync', ctx, {
          position: index + 1,
          submissionId: submission.id,
          email: submission.email,
          grade: grade ?? null,
          reason: skipReason,
          remainingCredits: pool?.remainingCredits ?? 0,
        })
        continue
      }

      try {
        gcLogInfo('Issuing reward for eligible submission', ctx, {
          position: index + 1,
          submissionId: submission.id,
          studentId: submission.student_id,
          email: submission.email,
          grade,
          rewardAmount,
        })

        await db.transaction(async (trx) => {
          const issued = await issueRewardForSubmission({
            institutionId: input.institutionId,
            studentId: submission.student_id,
            amount: rewardAmount,
            submissionId: submission.id,
            actorUserId: input.teacherId,
            fundingSource: 'teacher',
            teacherId: input.teacherId,
            client: trx,
          })

          await trx
            .from('submissions')
            .where('id', submission.id)
            .update({
              status: 'approved',
              reward_skipped_reason: null,
              updated_at: new Date(),
            })

          await trx.table('submission_validations').insert({
            submission_id: submission.id,
            teacher_id: input.teacherId,
            school_admin_id: null,
            action: 'validate',
            comment: 'Sincronizado desde Google Classroom',
            created_at: new Date(),
          })

          await trx.table('submission_validations').insert({
            submission_id: submission.id,
            teacher_id: null,
            school_admin_id: null,
            action: 'auto_approve',
            comment: 'Recompensa por sincronizacion Classroom (nota valida, orden FIFO)',
            created_at: new Date(),
          })

          gcLogInfo('Reward issued for submission', ctx, {
            submissionId: submission.id,
            transactionId: issued.transactionId,
            idempotent: issued.idempotent,
            amount: issued.amount,
          })
        })

        result.rewarded += 1
        result.rewardedSubmissionIds.push(submission.id)
        pool = await getTeacherCreditPoolSummary(input.teacherId)

        gcLogInfo('Teacher pool updated after reward', ctx, {
          submissionId: submission.id,
          remainingCredits: pool?.remainingCredits ?? 0,
        })
      } catch (error) {
        if (error instanceof InsufficientTeacherCreditsError) {
          result.skippedBudgetExhausted += 1
          await db
            .from('submissions')
            .where('id', submission.id)
            .update({ reward_skipped_reason: 'budget_exhausted' })

          gcLogWarn('Classroom sync stopped: teacher credits exhausted mid-run', ctx, {
            submissionId: submission.id,
            remainingCredits: error.remaining,
            requestedCredits: error.requested,
          })
          break
        }
        throw error
      }
    }

    result.budgetRemaining = pool?.remainingCredits ?? 0

    task.syncMetadata = {
      ...metadata,
      lastSyncAt: DateTime.now().toISO(),
      lastSyncSummary: {
        rewarded: result.rewarded,
        skippedNoSubmission: result.skippedNoSubmission,
        skippedLowGrade: result.skippedLowGrade,
        skippedNoGrade: result.skippedNoGrade,
        skippedAlreadyRewarded: result.skippedAlreadyRewarded,
        skippedBudgetExhausted: result.skippedBudgetExhausted,
        budgetRemaining: result.budgetRemaining,
      },
    }
    await task.save()

    await markTeacherIntegrationSynced(input.teacherId)

    gcLogInfo('Classroom sync completed', ctx, {
      ...result,
      scholarfiSubmissionCount: scholarfiSubmissions.length,
      gcGradeEntryCount: gradeByEmail.size,
    })

    return result
  } catch (error) {
    gcLogError('Classroom sync failed', ctx, error)
    throw error
  }
}
