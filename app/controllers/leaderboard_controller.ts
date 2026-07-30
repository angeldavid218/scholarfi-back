import type { HttpContext } from '@adonisjs/core/http'
import {
  getInstitutionStudentLeaderboard,
  resolveLeaderboardInstitutionId,
} from '#services/leaderboard/student_leaderboard_service'

export default class LeaderboardController {
  /**
   * GET /leaderboard/students — institution-scoped outstanding students (MVP).
   */
  async students({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const institutionId = await resolveLeaderboardInstitutionId(user)
    if (!institutionId) {
      return response.unprocessableEntity({
        error: {
          code: 'INSTITUTION_REQUIRED',
          message: 'User must belong to an institution to view the leaderboard',
          requestId: request.id(),
        },
      })
    }

    const limitRaw = Number(request.input('limit', 10))
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50 ? Math.floor(limitRaw) : 10

    const board = await getInstitutionStudentLeaderboard({
      institutionId,
      currentUserId: user.id,
      limit,
    })

    return response.ok(board)
  }
}
