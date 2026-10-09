import Task from '#models/task'
import db from '@adonisjs/lucid/services/db'
import { issueRewardForSubmission } from '#services/credits/reward_issuance_service'
import {
  remainingCreditsForFundingSource,
  resolvePreferredRewardFunding,
} from '#services/credits/task_reward_funding'
import {
  InsufficientInstitutionCreditsError,
  InsufficientTeacherCreditsError,
} from '#services/credits/types'
import googleClassroomConfig from '#config/google_classroom'
import { buildClassroomGradeMaps } from '#services/integrations/google_classroom/client'
import { resolveClassroomGradeForUser } from '#services/integrations/google_classroom/grade_maps'
import {
  linkGroupStudentsByEmail,
  persistClassroomUserIdsFromRoster,
} from '#services/integrations/google_classroom/group_link_service'
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
import {
  evaluateClassroomRewardEligibility,
  type ClassroomSyncSkipReason,
} from '#services/integrations/google_classroom/sync_eligibility'
import type {
  GoogleClassroomSyncMetadata,
  GoogleClassroomSyncResult,
} from '#services/integrations/google_classroom/types'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'

interface SubmissionRow {
  id: number
  student_id: number
  status: string
  submitted_at: Date
  email: string
  google_classroom_user_id: string | null
}

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

  if (!raw?.courseId || !raw?.courseWorkId || raw.minGrade === null || raw.minGrade === undefined) {
    throw new Error('Task is missing Google Classroom sync metadata')
  }
  return raw
}

async function submissionAlreadyRewarded(submissionId: number): Promise<boolean> {
  const teacherRow = await db
    .from('teacher_credit_entries')
    .where('submission_id', submissionId)
    .andWhere('entry_type', 'reward_issue')
    .first()
  if (teacherRow) return true

  const institutionRow = await db
    .from('institution_credit_entries')
    .where('submission_id', submissionId)
    .andWhere('entry_type', 'reward_issue')
    .first()
  return Boolean(institutionRow)
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

    const refreshToken = await getTeacherRefreshToken(input.teacherId)
    if (!refreshToken) {
      gcLogWarn('Classroom sync aborted: teacher not connected', ctx)
      throw new Error('Teacher has not connected Google Classroom')
    }

    gcLogDebug('Classroom refresh token loaded for teacher', ctx)

    gcLogInfo('Fetching student submissions from Google Classroom', ctx)
    const { gradeByEmail, gradeByGoogleUserId, emailByUserId } = await buildClassroomGradeMaps({
      refreshToken,
      courseId: metadata.courseId,
      courseWorkId: metadata.courseWorkId,
      logCtx: ctx,
    })

    if (emailByUserId.size > 0) {
      const persistResult = await persistClassroomUserIdsFromRoster({
        institutionId: input.institutionId,
        emailByUserId,
      })
      gcLogInfo('Classroom Google user ids persisted on ScholarFi users', ctx, persistResult)
    }

    // Classroom tasks use a GC-linked group that may be empty until roster emails are enrolled.
    // Students often exist via CSV in a different group — link them here by email first.
    if (task.groupId && emailByUserId.size > 0) {
      const linked = await linkGroupStudentsByEmail(input.institutionId, task.groupId, [
        ...emailByUserId.values(),
      ])
      gcLogInfo('Classroom roster students linked to task group', ctx, {
        groupId: task.groupId,
        rosterEmailCount: emailByUserId.size,
        linked,
      })
    }

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

    gcLogInfo('Google Classroom grades loaded', ctx, {
      gradeEntryCount: gradeByEmail.size,
      gradeByGoogleUserIdCount: gradeByGoogleUserId.size,
      gradeKeys: [...gradeByEmail.keys()],
      googleUserIds: [...gradeByGoogleUserId.keys()],
      grades: Object.fromEntries(gradeByEmail.entries()),
    })

    // Token/budget assignment BEFORE loading the FIFO queue
    let funding = await resolvePreferredRewardFunding({
      teacherId: input.teacherId,
      institutionId: input.institutionId,
    })
    const rewardAmount = Number(task.rewardAmount)

    gcLogInfo('Credit pool at sync start (pre-FIFO assignment)', ctx, {
      fundingSource: funding.fundingSource,
      remainingCredits: funding.remainingCredits,
      rewardAmountPerStudent: rewardAmount,
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
        'users.email as email',
        'users.google_classroom_user_id as google_classroom_user_id'
      )) as SubmissionRow[]

    gcLogInfo('ScholarFi submissions loaded (FIFO order)', ctx, {
      scholarfiSubmissionCount: scholarfiSubmissions.length,
      queue: scholarfiSubmissions.map((row, index) => ({
        position: index + 1,
        submissionId: row.id,
        studentId: row.student_id,
        email: row.email,
        googleClassroomUserId: row.google_classroom_user_id,
        submittedAt: row.submitted_at,
        status: row.status,
      })),
    })

    if (scholarfiSubmissions.length === 0) {
      gcLogWarn('Classroom sync has grades but no ScholarFi submissions to reward', ctx, {
        groupId: task.groupId,
        rosterEmailCount: emailByUserId.size,
        gradeEntryCount: gradeByEmail.size,
        hint: 'Ensure roster emails match ScholarFi student accounts in this institution',
      })
    }
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

    for (const [index, submission] of scholarfiSubmissions.entries()) {
      const { grade, gradeFound, lookupKey } = resolveClassroomGradeForUser({
        email: submission.email,
        googleClassroomUserId: submission.google_classroom_user_id,
        gradeByEmail,
        gradeByGoogleUserId,
      })

      gcLogDebug('Evaluating submission for Classroom sync', ctx, {
        position: index + 1,
        submissionId: submission.id,
        studentId: submission.student_id,
        email: submission.email,
        googleClassroomUserId: submission.google_classroom_user_id,
        lookupKey,
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

      let skipReason: ClassroomSyncSkipReason | null = evaluateClassroomRewardEligibility({
        alreadyRewarded: await submissionAlreadyRewarded(submission.id),
        grade,
        minGrade: metadata.minGrade,
        remainingCredits: funding.remainingCredits,
        rewardAmount,
      })

      if (skipReason) {
        if (skipReason === 'already_rewarded') result.skippedAlreadyRewarded += 1
        else if (skipReason === 'no_grade') result.skippedNoGrade += 1
        else if (skipReason === 'grade_below_minimum') result.skippedLowGrade += 1
        else result.skippedBudgetExhausted += 1
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
          fundingSource: funding.fundingSource,
          remainingCredits: funding.remainingCredits,
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
          fundingSource: funding.fundingSource,
        })

        await db.transaction(async (trx) => {
          const issued = await issueRewardForSubmission({
            institutionId: input.institutionId,
            studentId: submission.student_id,
            amount: rewardAmount,
            submissionId: submission.id,
            actorUserId: input.teacherId,
            fundingSource: funding.fundingSource,
            teacherId: funding.fundingSource === 'teacher' ? input.teacherId : null,
            client: trx,
          })

          await trx.from('submissions').where('id', submission.id).update({
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
            fundingSource: issued.fundingSource,
          })
        })

        result.rewarded += 1
        result.rewardedSubmissionIds.push(submission.id)
        funding = {
          ...funding,
          remainingCredits: await remainingCreditsForFundingSource({
            fundingSource: funding.fundingSource,
            teacherId: input.teacherId,
            institutionId: input.institutionId,
          }),
        }

        gcLogInfo('Credit pool updated after reward', ctx, {
          submissionId: submission.id,
          fundingSource: funding.fundingSource,
          remainingCredits: funding.remainingCredits,
        })
      } catch (error) {
        if (
          error instanceof InsufficientTeacherCreditsError ||
          error instanceof InsufficientInstitutionCreditsError
        ) {
          result.skippedBudgetExhausted += 1
          await db
            .from('submissions')
            .where('id', submission.id)
            .update({ reward_skipped_reason: 'budget_exhausted' })

          gcLogWarn('Classroom sync stopped: credits exhausted mid-run', ctx, {
            submissionId: submission.id,
            fundingSource: funding.fundingSource,
            remainingCredits: error.remaining,
            requestedCredits: error.requested,
          })
          break
        }
        throw error
      }
    }

    result.budgetRemaining = funding.remainingCredits

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
      gcGradeByGoogleUserIdCount: gradeByGoogleUserId.size,
    })

    return result
  } catch (error) {
    gcLogError('Classroom sync failed', ctx, error)
    throw error
  }
}
