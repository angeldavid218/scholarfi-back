import Submission from '#models/submission'
import Task from '#models/task'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import { makeTokenService } from '#services/tokens/factory'
import { parsePositiveInt } from '../utils/parsePositive.ts'
import { DateTime } from 'luxon'



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
    const tokenService = await makeTokenService()
    const result = await tokenService.mintTokens({
      userId: submission.studentId,
      institutionId: submission.institutionId,
      amount: task.rewardAmount,
      achievementId: submission.id,
    const amount = task.rewardAmount

    let rewardTransaction: RewardTransaction | null = null
    let idempotent = false

    await db.transaction(async (trx) => {
      const existing = await RewardTransaction.query()
        .useTransaction(trx)
        .where('submission_id', submissionId)
        .first()

      if (existing) {
        idempotent = true
        rewardTransaction = existing
      } else {
        const inserted = await db
          .table('reward_transactions')
          .useTransaction(trx)
          .insert({
            institution_id: submission.institutionId,
            submission_id: submission.id,
            student_id: submission.studentId,
            amount,
            type: 'credit',
            status: 'posted',
            posted_at: DateTime.now().toJSDate(),
            created_at: new Date(),
            updated_at: null,
          })
          .returning('id')

        const row = inserted[0] as any
        const insertedRewardId = typeof row === 'number' ? row : row.id
        rewardTransaction = await RewardTransaction.query()
          .useTransaction(trx)
          .where('id', insertedRewardId)
          .firstOrFail()

        await db
          .table('simulated_balances')
          .useTransaction(trx)
          .insert({
            institution_id: submission.institutionId,
            student_id: submission.studentId,
            balance: amount,
            created_at: new Date(),
            updated_at: null,
          })
          .onConflict(['institution_id', 'student_id'])
          .merge({
            balance: db.raw('simulated_balances.balance + ?', [amount]),
            updated_at: new Date(),
          })
      }
    })

    return {
      data: {
        submissionId: submission.id,
        rewardTransactionId: result.transactionId,
        amount: task.rewardAmount,
        idempotent: result.idempotent ?? false,
      },
    }
  }

  async showStudentBalance({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const tokenService = await makeTokenService()
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

    const total = row?.total as string | number | undefined
    const creditsTotal = row?.credits_total as string | number | null | undefined

    return {
      data: {
        transactionCount: Number(total ?? 0),
        creditsTotal:
          creditsTotal === null || creditsTotal === undefined || creditsTotal === ''
            ? 0
            : Number(creditsTotal),
      },
    }
  }

  async listInstitutionHistory({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const page = parsePositiveInt(request.input('page'), 1)
    const perPage = Math.min(parsePositiveInt(request.input('perPage'), 10), 100)

    const tokenService = await makeTokenService()
    const { items, meta } = await tokenService.getInstitutionTransactionHistory(
      user.institutionId ?? -1,
      { page, perPage }
    )

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
