import Submission from '#models/submission'
import Task from '#models/task'
import SubmissionValidation from '#models/submission_validation'
import db from '@adonisjs/lucid/services/db'
import {
  InsufficientInstitutionCreditsError,
  issueRewardForSubmission,
} from '#services/credits/reward_issuance_service'
import {
  adminSubmissionDecisionValidator,
  createSubmissionValidator,
  teacherRejectSubmissionValidator,
  validateSubmissionActionValidator,
} from '#validators/task'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { parsePositiveInt } from '../utils/parse_positive.ts'

type DbErrorWithCode = Error & { code?: string }

const SUBMISSION_STATUS = {
  pending: 'pending',
  validated: 'validated',
  rejectedByTeacher: 'rejected_by_teacher',
  approved: 'approved',
  rejectedByAdmin: 'rejected_by_admin',
} as const

const STATUS_LABEL_ES: Record<string, string> = {
  [SUBMISSION_STATUS.pending]: 'Pendiente de validacion docente',
  [SUBMISSION_STATUS.validated]: 'Validada por docente',
  [SUBMISSION_STATUS.rejectedByTeacher]: 'Rechazada por docente',
  [SUBMISSION_STATUS.approved]: 'Aprobada por administracion escolar',
  [SUBMISSION_STATUS.rejectedByAdmin]: 'Rechazada por administracion escolar',
}

function statusLabelEs(status: string) {
  return STATUS_LABEL_ES[status] ?? status
}

function parseId(input: unknown): number | null {
  const parsed = Number(input)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export default class SubmissionsController {
  private async runTeacherAction(
    submissionId: number,
    teacherId: number,
    institutionId: number | null,
    action: 'validate' | 'reject',
    reason: string | null,
    requestId: string | undefined
  ) {
    const submission = await Submission.query()
      .innerJoin('tasks', 'tasks.id', 'submissions.task_id')
      .where('submissions.id', submissionId)
      .andWhere('submissions.institution_id', institutionId ?? -1)
      .andWhere('tasks.created_by_teacher_id', teacherId)
      .select('submissions.*')
      .first()

    if (!submission) {
      return {
        statusCode: 403 as const,
        payload: {
          error: {
            code: 'TENANT_SCOPE_VIOLATION',
            message: 'Cross-tenant access is not allowed',
            requestId: requestId ?? 'unknown',
          },
        },
      }
    }

    if (submission.status !== SUBMISSION_STATUS.pending) {
      return {
        statusCode: 422 as const,
        payload: {
          error: {
            code: 'INVALID_STATE_TRANSITION',
            message: 'Submission is not in a teacher-actionable state',
            requestId: requestId ?? 'unknown',
          },
        },
      }
    }

    await db.transaction(async (trx) => {
      submission.useTransaction(trx)
      submission.status =
        action === 'validate' ? SUBMISSION_STATUS.validated : SUBMISSION_STATUS.rejectedByTeacher
      await submission.save()

      await SubmissionValidation.create(
        {
          submissionId: submission.id,
          teacherId,
          schoolAdminId: null,
          action,
          comment: reason,
        },
        { client: trx }
      )
    })

    return {
      statusCode: 200 as const,
      payload: {
        data: {
          id: submission.id,
          status: submission.status,
          statusLabelEs: statusLabelEs(submission.status),
        },
      },
    }
  }

  async store({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(createSubmissionValidator)
    const user = auth.getUserOrFail()

    const task = await Task.query()
      .where('id', payload.taskId)
      .andWhere('institution_id', user.institutionId ?? -1)
      .first()

    if (!task || task.status !== 'active') {
      return response.unprocessableEntity({
        error: {
          code: 'TASK_NOT_ELIGIBLE_FOR_SUBMISSION',
          message: 'Task is not eligible for submissions',
          requestId: request.id(),
        },
      })
    }

    try {
      const submission = await Submission.create({
        institutionId: task.institutionId,
        taskId: task.id,
        studentId: user.id,
        evidenceText: payload.evidenceText,
        evidenceUrl: payload.evidenceUrl ?? null,
        status: SUBMISSION_STATUS.pending,
        submittedAt: DateTime.now(),
      })

      return {
        data: {
          id: submission.id,
          institutionId: submission.institutionId,
          taskId: submission.taskId,
          studentId: submission.studentId,
          evidenceText: submission.evidenceText,
          evidenceUrl: submission.evidenceUrl,
          status: submission.status,
          statusLabelEs: statusLabelEs(submission.status),
          submittedAt: submission.submittedAt,
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt,
        },
      }
    } catch (error) {
      const dbError = error as DbErrorWithCode
      if (dbError.code === '23505') {
        return response.unprocessableEntity({
          error: {
            code: 'DUPLICATE_SUBMISSION',
            message: 'Submission already exists for this task',
            requestId: request.id(),
          },
        })
      }
      throw error
    }
  }

  async show({ auth, request, response, params }: HttpContext) {
    const user = auth.getUserOrFail()
    const submissionId = parseId(params.id)
    if (!submissionId) {
      return response.badRequest({
        error: {
          code: 'INVALID_SUBMISSION_ID',
          message: 'Submission id is invalid',
          requestId: request.id(),
        },
      })
    }

    const submission = await Submission.query()
      .where('id', submissionId)
      .andWhere('student_id', user.id)
      .andWhere('institution_id', user.institutionId ?? -1)
      .first()
    if (!submission) {
      return response.forbidden({
        error: {
          code: 'TENANT_SCOPE_VIOLATION',
          message: 'Cross-tenant access is not allowed',
          requestId: request.id(),
        },
      })
    }

    const history = await SubmissionValidation.query()
      .where('submission_id', submission.id)
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')

    return {
      data: {
        id: submission.id,
        institutionId: submission.institutionId,
        taskId: submission.taskId,
        studentId: submission.studentId,
        evidenceText: submission.evidenceText,
        evidenceUrl: submission.evidenceUrl,
        status: submission.status,
        statusLabelEs: statusLabelEs(submission.status),
        submittedAt: submission.submittedAt,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        history: history.map((item) => ({
          id: item.id,
          action: item.action,
          comment: item.comment,
          actorRole: item.teacherId ? 'teacher' : 'school_admin',
          actorId: item.teacherId ?? item.schoolAdminId,
          createdAt: item.createdAt,
        })),
      },
    }
  }

  async index({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const rows = await Submission.query()
      .where('institution_id', user.institutionId ?? -1)
      .andWhere('student_id', user.id)
      .orderBy('submitted_at', 'desc')
      .orderBy('id', 'desc')

    return {
      data: rows.map((submission) => ({
        id: submission.id,
        institutionId: submission.institutionId,
        taskId: submission.taskId,
        studentId: submission.studentId,
        evidenceText: submission.evidenceText,
        evidenceUrl: submission.evidenceUrl,
        status: submission.status,
        statusLabelEs: statusLabelEs(submission.status),
        submittedAt: submission.submittedAt,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
      })),
    }
  }

  async teacherQueue({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const page = parsePositiveInt(request.input('page'), 1)
    const perPage = Math.min(parsePositiveInt(request.input('perPage'), 10), 100)

    const rows = await Submission.query()
      .innerJoin('tasks', 'tasks.id', 'submissions.task_id')
      .where('submissions.institution_id', user.institutionId ?? -1)
      .andWhere('tasks.created_by_teacher_id', user.id)
      .andWhere('submissions.status', SUBMISSION_STATUS.pending)
      .select(
        'submissions.id',
        'submissions.task_id',
        'submissions.student_id',
        'submissions.evidence_text',
        'submissions.evidence_url',
        'submissions.status',
        'submissions.submitted_at',
        'submissions.created_at',
        'submissions.updated_at',
        'tasks.title'
      )
      .orderBy('submissions.submitted_at', 'asc')
      .paginate(page, perPage)

    return {
      data: {
        items: rows.all().map((row: any) => ({
          id: row.id,
          taskId: row.taskId,
          studentId: row.studentId,
          evidenceText: row.evidenceText,
          evidenceUrl: row.evidenceUrl,
          taskTitle: row.title,
          status: row.status,
          statusLabelEs: statusLabelEs(row.status),
          submittedAt: row.submittedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
        meta: rows.getMeta(),
      },
    }
  }

  async teacherAction({ auth, request, response, params }: HttpContext) {
    const payload = await request.validateUsing(validateSubmissionActionValidator)
    if (payload.action === 'reject' && !payload.reason) {
      return response.unprocessableEntity({
        error: {
          code: 'REJECTION_REASON_REQUIRED',
          message: 'Rejection reason is required',
          requestId: request.id(),
        },
      })
    }
    const user = auth.getUserOrFail()
    const submissionId = parseId(params.id)
    if (!submissionId) {
      return response.badRequest({
        error: {
          code: 'INVALID_SUBMISSION_ID',
          message: 'Submission id is invalid',
          requestId: request.id(),
        },
      })
    }

    const result = await this.runTeacherAction(
      submissionId,
      user.id,
      user.institutionId,
      payload.action,
      payload.reason ?? null,
      request.id()
    )
    if (result.statusCode === 403) return response.forbidden(result.payload)
    if (result.statusCode === 422) return response.unprocessableEntity(result.payload)
    return result.payload
  }

  async teacherReject({ auth, request, response, params }: HttpContext) {
    const payload = await request.validateUsing(teacherRejectSubmissionValidator)
    const user = auth.getUserOrFail()
    const submissionId = parseId(params.id)
    if (!submissionId) {
      return response.badRequest({
        error: {
          code: 'INVALID_SUBMISSION_ID',
          message: 'Submission id is invalid',
          requestId: request.id(),
        },
      })
    }
    const result = await this.runTeacherAction(
      submissionId,
      user.id,
      user.institutionId,
      'reject',
      payload.reason,
      request.id()
    )
    if (result.statusCode === 403) return response.forbidden(result.payload)
    if (result.statusCode === 422) return response.unprocessableEntity(result.payload)
    return result.payload
  }

  async adminQueue({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const page = parsePositiveInt(request.input('page'), 1)
    const perPage = Math.min(parsePositiveInt(request.input('perPage'), 10), 100)

    const rows = await Submission.query()
      .innerJoin('tasks', 'tasks.id', 'submissions.task_id')
      .innerJoin('users', 'users.id', 'submissions.student_id')
      .where('submissions.institution_id', user.institutionId ?? -1)
      .andWhere('submissions.status', SUBMISSION_STATUS.validated)
      .select(
        'submissions.id',
        'submissions.task_id',
        'submissions.student_id',
        'submissions.evidence_text',
        'submissions.evidence_url',
        'submissions.status',
        'submissions.submitted_at',
        'submissions.created_at',
        'submissions.updated_at',
        'tasks.title',
        'users.full_name as studentName'
      )
      .orderBy('submissions.submitted_at', 'asc')
      .paginate(page, perPage)

    return {
      data: {
        items: rows.all().map((row) => {
          const studentName =
            (row.$extras.studentName as string | undefined) ??
            (row as { studentName?: string }).studentName ??
            ''
          return {
            id: row.id,
            taskId: row.taskId,
            studentId: row.studentId,
            studentName,
            evidenceText: row.evidenceText,
            evidenceUrl: row.evidenceUrl,
            taskTitle: (row as { title?: string }).title ?? '',
            status: row.status,
            statusLabelEs: statusLabelEs(row.status),
            submittedAt: row.submittedAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }
        }),
        meta: rows.getMeta(),
      },
    }
  }

  async adminDecision({ auth, request, response, params }: HttpContext) {
    const payload = await request.validateUsing(adminSubmissionDecisionValidator)
    if (payload.decision === 'reject' && !payload.reason) {
      return response.unprocessableEntity({
        error: {
          code: 'REJECTION_REASON_REQUIRED',
          message: 'Rejection reason is required',
          requestId: request.id(),
        },
      })
    }
    const user = auth.getUserOrFail()
    const submissionId = parseId(params.id)
    if (!submissionId) {
      return response.badRequest({
        error: {
          code: 'INVALID_SUBMISSION_ID',
          message: 'Submission id is invalid',
          requestId: request.id(),
        },
      })
    }

    const submission = await Submission.query()
      .where('id', submissionId)
      .andWhere('institution_id', user.institutionId ?? -1)
      .first()
    if (!submission) {
      return response.forbidden({
        error: {
          code: 'TENANT_SCOPE_VIOLATION',
          message: 'Cross-tenant access is not allowed',
          requestId: request.id(),
        },
      })
    }

    if (submission.status !== SUBMISSION_STATUS.validated) {
      return response.unprocessableEntity({
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: 'Submission is not in an admin-actionable state',
          requestId: request.id(),
        },
      })
    }

    const isApprove = payload.decision === 'approve'
    const nextStatus = isApprove ? SUBMISSION_STATUS.approved : SUBMISSION_STATUS.rejectedByAdmin
    const task = isApprove ? await Task.findOrFail(submission.taskId) : null
    let rewardTransactionId: number | null = null

    try {
      await db.transaction(async (trx) => {
        submission.useTransaction(trx)
        submission.status = nextStatus
        await submission.save()

        await SubmissionValidation.create(
          {
            submissionId: submission.id,
            teacherId: null,
            schoolAdminId: user.id,
            action: payload.decision,
            comment: payload.reason ?? null,
          },
          { client: trx }
        )

        if (isApprove) {
          const issued = await issueRewardForSubmission({
            institutionId: submission.institutionId,
            studentId: submission.studentId,
            amount: task!.rewardAmount,
            submissionId: submission.id,
            actorUserId: user.id,
            client: trx,
          })
          rewardTransactionId = issued.transactionId
        }
      })
    } catch (error) {
      if (error instanceof InsufficientInstitutionCreditsError) {
        return response.unprocessableEntity({
          error: {
            code: error.code,
            message: 'La institución no tiene créditos suficientes para esta recompensa',
            details: {
              remainingCredits: error.remaining,
              requestedCredits: error.requested,
            },
            requestId: request.id(),
          },
        })
      }
      throw error
    }

    return {
      data: {
        id: submission.id,
        status: submission.status,
        statusLabelEs: statusLabelEs(submission.status),
        rewardTransactionId,
      },
    }
  }
}
