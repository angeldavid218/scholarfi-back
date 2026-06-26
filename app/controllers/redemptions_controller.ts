import CatalogReward from '#models/catalog_reward'
import Redemption from '#models/redemption'
import { createRedemptionValidator, rejectRedemptionValidator } from '#validators/redemption'
import { makeTokenService } from '#services/tokens/factory'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { parsePositiveInt } from '../utils/parse_positive.ts'

function parseId(input: unknown): number | null {
  const parsed = Number(input)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export default class RedemptionsController {
  async store({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(createRedemptionValidator)
    const user = auth.getUserOrFail()

    if (!user.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Institution scope required',
          requestId: request.id(),
        },
      })
    }

    const catalog = await CatalogReward.query()
      .where('id', payload.rewardId)
      .andWhere('institution_id', user.institutionId)
      .first()

    if (!catalog) {
      return response.notFound({
        error: {
          code: 'REWARD_NOT_FOUND',
          message: 'Reward not available',
          requestId: request.id(),
        },
      })
    }

    const tokenService = await makeTokenService()
    const balance = await tokenService.getBalance(String(user.id))
    if (balance < catalog.creditCost) {
      return response.unprocessableEntity({
        error: {
          code: 'INSUFFICIENT_CREDITS',
          message: 'Not enough credits for this reward',
          requestId: request.id(),
        },
      })
    }

    const redemption = await Redemption.create({
      institutionId: user.institutionId,
      userId: user.id,
      rewardId: catalog.id,
      amount: catalog.creditCost,
      status: 'pending',
    })

    return {
      data: {
        id: redemption.id,
        institutionId: redemption.institutionId,
        userId: redemption.userId,
        rewardId: redemption.rewardId,
        amount: redemption.amount,
        status: redemption.status,
        createdAt: redemption.createdAt,
      },
    }
  }

  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!user.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Institution scope required',
          requestId: request.id(),
        },
      })
    }

    const page = parsePositiveInt(request.input('page'), 1)
    const perPage = Math.min(parsePositiveInt(request.input('perPage'), 10), 100)
    const status = request.input('status', '') as string
    const studentId = parseId(request.input('studentId'))

    let q = Redemption.query()
      .where('institution_id', user.institutionId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')

    const actorRole = await db
      .from('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .where('user_roles.user_id', user.id)
      .select('roles.key as key')
      .first()

    const roleKey = actorRole?.key as string | undefined
    if (roleKey === 'student') {
      q = q.andWhere('user_id', user.id)
    }

    if (studentId && roleKey === 'school_admin') {
      q = q.andWhere('user_id', studentId)
    }

    if (status.length > 0) {
      q = q.andWhere('status', status)
    }

    const rows = await q.paginate(page, perPage)

    return {
      data: {
        items: rows.all().map((r) => ({
          id: r.id,
          institutionId: r.institutionId,
          userId: r.userId,
          rewardId: r.rewardId,
          amount: r.amount,
          status: r.status,
          transactionSignature: r.transactionSignature,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        meta: rows.getMeta(),
      },
    }
  }

  async approve({ auth, request, response, params }: HttpContext) {
    const user = auth.getUserOrFail()
    const id = parseId(params.id)
    if (!id) {
      return response.badRequest({
        error: {
          code: 'INVALID_REDEMPTION_ID',
          message: 'Redemption id is invalid',
          requestId: request.id(),
        },
      })
    }

    if (!user.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Institution scope required',
          requestId: request.id(),
        },
      })
    }

    const redemption = await Redemption.query()
      .where('id', id)
      .andWhere('institution_id', user.institutionId)
      .first()

    if (!redemption) {
      return response.notFound({
        error: {
          code: 'REDEMPTION_NOT_FOUND',
          message: 'Redemption not found',
          requestId: request.id(),
        },
      })
    }

    if (redemption.status !== 'pending') {
      return response.unprocessableEntity({
        error: {
          code: 'INVALID_REDEMPTION_STATE',
          message: 'Redemption is not pending',
          requestId: request.id(),
        },
      })
    }

    const tokenService = await makeTokenService()
    const result = await tokenService.redeemTokens({
      userId: redemption.userId,
      institutionId: redemption.institutionId,
      amount: redemption.amount,
      redemptionId: redemption.id,
    })

    if (result.status === 'failed') {
      redemption.status = 'failed'
      await redemption.save()
      return response.unprocessableEntity({
        error: {
          code: 'REDEMPTION_EXECUTION_FAILED',
          message: 'Could not complete redemption',
          requestId: request.id(),
        },
      })
    }

    redemption.status = 'completed'
    redemption.transactionSignature = result.transactionSignature
    await redemption.save()

    return {
      data: {
        id: redemption.id,
        status: redemption.status,
        transactionSignature: redemption.transactionSignature,
        tokenTransactionId: result.transactionId,
      },
    }
  }

  async reject({ auth, request, response, params }: HttpContext) {
    const payload = await request.validateUsing(rejectRedemptionValidator)
    const user = auth.getUserOrFail()
    const id = parseId(params.id)
    if (!id) {
      return response.badRequest({
        error: {
          code: 'INVALID_REDEMPTION_ID',
          message: 'Redemption id is invalid',
          requestId: request.id(),
        },
      })
    }

    if (!user.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Institution scope required',
          requestId: request.id(),
        },
      })
    }

    const redemption = await Redemption.query()
      .where('id', id)
      .andWhere('institution_id', user.institutionId)
      .first()

    if (!redemption) {
      return response.notFound({
        error: {
          code: 'REDEMPTION_NOT_FOUND',
          message: 'Redemption not found',
          requestId: request.id(),
        },
      })
    }

    if (redemption.status !== 'pending') {
      return response.unprocessableEntity({
        error: {
          code: 'INVALID_REDEMPTION_STATE',
          message: 'Redemption cannot be rejected',
          requestId: request.id(),
        },
      })
    }

    redemption.status = 'rejected'
    await redemption.save()

    return {
      data: {
        id: redemption.id,
        status: redemption.status,
        reason: payload.reason ?? null,
      },
    }
  }
}
