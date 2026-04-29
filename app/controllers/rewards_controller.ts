import RewardTransaction from '#models/reward_transaction'
import SimulatedBalance from '#models/simulated_balance'
import Submission from '#models/submission'
import Task from '#models/task'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
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
    const amount = task.rewardAmount

    let rewardTransaction: RewardTransaction | null = null
    let idempotent = false

    await db.transaction(async (trx) => {
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
        .onConflict('submission_id')
        .ignore()
        .returning('id')

      if (inserted.length > 0) {
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
      } else {
        idempotent = true
        rewardTransaction = await RewardTransaction.query()
          .useTransaction(trx)
          .where('submission_id', submission.id)
          .firstOrFail()
      }
    })

    return {
      data: {
        submissionId: submission.id,
        rewardTransactionId: rewardTransaction!.id,
        amount,
        idempotent,
      },
    }
  }

  async showStudentBalance({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const balance = await SimulatedBalance.query()
      .where('institution_id', user.institutionId ?? -1)
      .andWhere('student_id', user.id)
      .first()

    return {
      data: {
        institutionId: user.institutionId,
        studentId: user.id,
        simulatedBalance: balance?.balance ?? 0,
      },
    }
  }

  async listInstitutionHistory({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const rewards = await RewardTransaction.query()
      .where('institution_id', user.institutionId ?? -1)
      .orderBy('posted_at', 'desc')
      .orderBy('id', 'desc')

    return {
      data: rewards.map((reward) => ({
        id: reward.id,
        institutionId: reward.institutionId,
        submissionId: reward.submissionId,
        studentId: reward.studentId,
        amount: reward.amount,
        type: reward.type,
        status: reward.status,
        postedAt: reward.postedAt,
        createdAt: reward.createdAt,
      })),
    }
  }
}
