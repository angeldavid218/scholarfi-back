import type { HttpContext } from '@adonisjs/core/http'
import {
  buildGradeProgressSummary,
  listInstitutionGradeProgress,
  listTeacherStudentIds,
} from '#services/analytics/grade_progress_service'
import { userHasRole } from '#services/role_query_service'

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

export default class GradeProgressController {
  /**
   * GET /grade-progress — grade progress analytics.
   * school_admin: institution-wide. teacher: students in their groups.
   * Prefer school_admin scope when the user has both roles.
   */
  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const missing = institutionIdOrFail(user, request.id())
    if (missing) return response.unprocessableEntity(missing)

    const institutionId = user.institutionId!
    const isSchoolAdmin = await userHasRole(user.id, 'school_admin')

    let students
    if (isSchoolAdmin) {
      students = await listInstitutionGradeProgress(institutionId)
    } else {
      const studentIds = await listTeacherStudentIds(institutionId, user.id)
      students = await listInstitutionGradeProgress(institutionId, { studentIds })
    }

    const summary = buildGradeProgressSummary(students)
    return response.ok({ summary, students })
  }
}
