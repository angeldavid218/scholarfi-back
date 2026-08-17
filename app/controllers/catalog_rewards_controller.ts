import CatalogReward from '#models/catalog_reward'
import {
  createCatalogRewardValidator,
  updateCatalogRewardValidator,
} from '#validators/catalog_reward'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

function parseId(input: unknown): number | null {
  const parsed = Number(input)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function serializeReward(r: CatalogReward) {
  return {
    id: r.id,
    institutionId: r.institutionId,
    title: r.title,
    description: r.description,
    creditCost: r.creditCost,
    isActive: r.isActive,
    source: r.source,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

export default class CatalogRewardsController {
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

    const roleRows = await db
      .from('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .where('user_roles.user_id', user.id)
      .select('roles.key')

    const isSchoolAdmin = roleRows.some((row) => row.key === 'school_admin')

    let query = CatalogReward.query()
      .where('institution_id', user.institutionId)
      .andWhere('source', 'internal')

    if (!isSchoolAdmin) {
      query = query.andWhere('is_active', true)
    }

    const rows = await query.orderBy('id', 'asc')

    return {
      data: rows.map(serializeReward),
    }
  }

  async store({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(createCatalogRewardValidator)
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

    const row = await CatalogReward.create({
      institutionId: user.institutionId,
      title: payload.title,
      description: payload.description ?? null,
      creditCost: payload.creditCost,
      isActive: true,
      source: 'internal',
    })

    return {
      data: serializeReward(row),
    }
  }

  async update({ auth, request, response, params }: HttpContext) {
    const payload = await request.validateUsing(updateCatalogRewardValidator)
    const user = auth.getUserOrFail()
    const id = parseId(params.id)

    if (!id) {
      return response.badRequest({
        error: {
          code: 'INVALID_REWARD_ID',
          message: 'Reward id is invalid',
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

    const row = await CatalogReward.query()
      .where('id', id)
      .andWhere('institution_id', user.institutionId)
      .andWhere('source', 'internal')
      .first()

    if (!row) {
      return response.notFound({
        error: {
          code: 'REWARD_NOT_FOUND',
          message: 'Reward not found',
          requestId: request.id(),
        },
      })
    }

    if (payload.title !== undefined) row.title = payload.title
    if (payload.description !== undefined) row.description = payload.description
    if (payload.creditCost !== undefined) row.creditCost = payload.creditCost
    if (payload.isActive !== undefined) row.isActive = payload.isActive

    await row.save()

    return {
      data: serializeReward(row),
    }
  }
}
