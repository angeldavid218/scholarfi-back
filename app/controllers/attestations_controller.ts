import type { HttpContext } from '@adonisjs/core/http'
import { isSasEnabled } from '#services/attestation/sas_attestation_client'
import {
  getMilestoneAttestationPreview,
  runMilestoneAttestationsForInstitution,
} from '#services/attestation/milestone_attestation_service'
import { isInstitutionOnChainExecution } from '#services/tokens/factory'

function institutionIdOrFail(user: { institutionId: number | null }, requestId?: string) {
  if (!user.institutionId) {
    return {
      error: {
        code: 'INSTITUTION_REQUIRED',
        message: 'User must belong to an institution',
        requestId,
      },
    }
  }
  return null
}

export default class AttestationsController {
  /**
   * GET /attestations/milestones/preview — eligible students + attestation status.
   */
  async previewMilestones({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const missing = institutionIdOrFail(user, request.id())
    if (missing) return response.unprocessableEntity(missing)

    const payload = await getMilestoneAttestationPreview(user.institutionId!)
    return response.ok(payload)
  }

  /**
   * POST /attestations/milestones/run — batch issue milestone SAS attestations.
   */
  async runMilestones({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const missing = institutionIdOrFail(user, request.id())
    if (missing) return response.unprocessableEntity(missing)

    if (!isSasEnabled()) {
      return response.unprocessableEntity({
        error: {
          code: 'SAS_DISABLED',
          message: 'SAS_ENABLED is not true — configure SAS before issuing attestations',
          requestId: request.id(),
        },
      })
    }

    const onChain = await isInstitutionOnChainExecution(user.institutionId!)
    if (!onChain) {
      return response.unprocessableEntity({
        error: {
          code: 'ON_CHAIN_DISABLED',
          message: 'Institution is not on-chain — attestations require Solana token mode',
          requestId: request.id(),
        },
      })
    }

    const rawStudentId = request.input('studentId')
    const studentId =
      rawStudentId !== undefined && rawStudentId !== null && rawStudentId !== ''
        ? Number(rawStudentId)
        : undefined

    if (studentId !== undefined && (!Number.isInteger(studentId) || studentId <= 0)) {
      return response.badRequest({
        error: {
          code: 'INVALID_STUDENT_ID',
          message: 'studentId must be a positive integer',
          requestId: request.id(),
        },
      })
    }

    try {
      const payload = await runMilestoneAttestationsForInstitution({
        institutionId: user.institutionId!,
        studentId,
      })
      return response.ok(payload)
    } catch (error) {
      return response.internalServerError({
        error: {
          code: 'MILESTONE_ATTESTATION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          requestId: request.id(),
        },
      })
    }
  }
}
