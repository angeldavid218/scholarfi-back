import Submission from '#models/submission'
import Task from '#models/task'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import { getInstitutionCreditPoolSummary } from '#services/credits/institution_credit_pool_service'
import {
  InsufficientInstitutionCreditsError,
  issueRewardForSubmission,
} from '#services/credits/reward_issuance_service'
import { makeTokenServiceForInstitution } from '#services/tokens/factory'
import { parsePositiveInt } from '../utils/parse_positive.ts'

function parseId(input: unknown): number | null {
  const parsed = Number(input)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export default class RewardsController {
  async postForSubmission({ auth, request, response, params }: HttpContext) {
    const user = auth.getUserOrFail()
    const submissionId = parseId(params.submissionId)
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
    if (submission.status !== 'approved') {
      return response.unprocessableEntity({
        error: {
          code: 'SUBMISSION_NOT_APPROVED_FOR_REWARD',
          message: 'Submission must be approved before reward posting',
          requestId: request.id(),
        },
      })
    }

    const task = await Task.findOrFail(submission.taskId)

    try {
      const result = await issueRewardForSubmission({
        institutionId: submission.institutionId,
        studentId: submission.studentId,
        amount: task.rewardAmount,
        submissionId: submission.id,
        actorUserId: user.id,
      })

      return {
        data: {
          submissionId: submission.id,
          rewardTransactionId: result.transactionId,
          amount: task.rewardAmount,
          idempotent: result.idempotent,
        },
      }
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
  }

  async showStudentBalance({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const institutionId = user.institutionId ?? -1
    const tokenService = await makeTokenServiceForInstitution(institutionId)
    const balance = await tokenService.getBalance(String(user.id))

    return {
      data: {
        institutionId: user.institutionId,
        studentId: user.id,
        simulatedBalance: balance,
      },
    }
  }

  async historySummary({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const row = await db
      .from('token_transactions')
      .where('institution_id', user.institutionId ?? -1)
      .where('type', 'mint')
      .where('status', 'confirmed')
      .count('* as total')
      .sum('amount as credits_total')
      .first()

    const pool = user.institutionId
      ? await getInstitutionCreditPoolSummary(user.institutionId)
      : null

    const total = row?.total as string | number | undefined
    const creditsTotal = row?.credits_total as string | number | null | undefined

    return {
      data: {
        transactionCount: Number(total ?? 0),
        creditsTotal:
          creditsTotal === null || creditsTotal === undefined || creditsTotal === ''
            ? 0
            : Number(creditsTotal),
        creditPool: pool,
      },
    }
  }

  async listInstitutionHistory({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const page = parsePositiveInt(request.input('page'), 1)
    const perPage = Math.min(parsePositiveInt(request.input('perPage'), 10), 100)
    const institutionId = user.institutionId ?? -1

    const tokenService = await makeTokenServiceForInstitution(institutionId)
    const { items, meta } = await tokenService.getInstitutionTransactionHistory(institutionId, {
      page,
      perPage,
    })

    const studentIds = [...new Set(items.map((i) => i.userId))]
    const namesById = new Map<number, string>()
    if (studentIds.length > 0) {
      const users = await User.query().whereIn('id', studentIds).select('id', 'full_name')
      for (const u of users) {
        namesById.set(u.id, u.fullName ?? '')
      }
    }

    return {
      data: {
        items: items.map((reward) => ({
          id: reward.id,
          institutionId: reward.institutionId,
          submissionId: reward.achievementId,
          studentId: reward.userId,
          studentName: namesById.get(reward.userId) ?? '',
          amount: reward.amount,
          type: reward.type,
          status: reward.status,
          provider: reward.provider,
          transactionSignature: reward.transactionSignature,
          postedAt: reward.createdAt,
          createdAt: reward.createdAt,
        })),
        meta,
      },
    }
  }
}
