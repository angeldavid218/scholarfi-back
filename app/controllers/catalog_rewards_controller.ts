import CatalogReward from '#models/catalog_reward'
import { createCatalogRewardValidator } from '#validators/catalog_reward'
import type { HttpContext } from '@adonisjs/core/http'

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

    const rows = await CatalogReward.query()
      .where('institution_id', user.institutionId)
      .orderBy('id', 'asc')

    return {
      data: rows.map((r) => ({
        id: r.id,
        institutionId: r.institutionId,
        title: r.title,
        description: r.description,
        creditCost: r.creditCost,
        createdAt: r.createdAt,
      })),
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
    })

    return {
      data: {
        id: row.id,
        institutionId: row.institutionId,
        title: row.title,
        description: row.description,
        creditCost: row.creditCost,
        createdAt: row.createdAt,
      },
    }
  }
}
