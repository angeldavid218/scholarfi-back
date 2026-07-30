import type { HttpContext } from '@adonisjs/core/http'
import { getStudentAchievementsForUi } from '#services/attestation/milestone_attestation_service'

export default class AchievementsController {
  /**
   * GET /achievements/me — student milestone progress + SAS attestation status.
   */
  async me({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!user.institutionId) {
      return response.unprocessableEntity({
        error: {
          code: 'INSTITUTION_REQUIRED',
          message: 'User must belong to an institution to view achievements',
          requestId: request.id(),
        },
      })
    }

    const payload = await getStudentAchievementsForUi({
      studentId: user.id,
      institutionId: user.institutionId,
    })

    return response.ok(payload)
  }
}
