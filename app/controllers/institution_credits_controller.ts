import Institution from '#models/institution'
import {
  allocateInstitutionCredits,
  getInstitutionCreditPoolSummary,
} from '#services/credits/institution_credit_pool_service'
import { allocateInstitutionCreditsValidator } from '#validators/institution_credit'
import type { HttpContext } from '@adonisjs/core/http'

function parseInstitutionId(input: unknown): number | null {
  const parsed = Number(input)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export default class InstitutionCreditsController {
  /** School admin: view own institution credit pool */
  async showMine({ auth, request, response }: HttpContext) {
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

    const summary = await getInstitutionCreditPoolSummary(user.institutionId)
    return { data: summary }
  }

  /** Super admin: view any institution pool */
  async show({ params, response }: HttpContext) {
    const institutionId = parseInstitutionId(params.id)
    if (!institutionId) {
      return response.badRequest({
        error: {
          code: 'INVALID_INSTITUTION_ID',
          message: 'Institution id is invalid',
        },
      })
    }

    const institution = await Institution.find(institutionId)
    if (!institution) {
      return response.notFound({
        error: {
          code: 'INSTITUTION_NOT_FOUND',
          message: 'Institution not found',
        },
      })
    }

    const summary = await getInstitutionCreditPoolSummary(institutionId)
    return { data: summary }
  }

  /** Super admin: assign credits to an institution pool */
  async allocate({ auth, request, response, params }: HttpContext) {
    const payload = await request.validateUsing(allocateInstitutionCreditsValidator)
    const actor = auth.getUserOrFail()
    const institutionId = parseInstitutionId(params.id)

    if (!institutionId) {
      return response.badRequest({
        error: {
          code: 'INVALID_INSTITUTION_ID',
          message: 'Institution id is invalid',
          requestId: request.id(),
        },
      })
    }

    const institution = await Institution.find(institutionId)
    if (!institution) {
      return response.notFound({
        error: {
          code: 'INSTITUTION_NOT_FOUND',
          message: 'Institution not found',
          requestId: request.id(),
        },
      })
    }

    const summary = await allocateInstitutionCredits({
      institutionId,
      amount: payload.amount,
      actorUserId: actor.id,
      notes: payload.notes ?? null,
    })

    return {
      data: {
        ...summary,
        allocatedAmount: payload.amount,
      },
    }
  }
}
