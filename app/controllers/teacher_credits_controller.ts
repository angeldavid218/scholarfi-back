import {
  allocateEqualToAllTeachers,
  allocateToTeacher,
  getInstitutionBudgetBreakdown,
  getTeacherCreditPoolSummary,
  listTeacherCreditPoolsForInstitution,
} from '#services/credits/teacher_credit_pool_service'
import { InsufficientInstitutionBudgetToAssignError } from '#services/credits/types'
import {
  allocateEqualTeacherCreditsValidator,
  allocateTeacherCreditsValidator,
} from '#validators/teacher_credit'
import type { HttpContext } from '@adonisjs/core/http'

function parseTeacherId(input: unknown): number | null {
  const parsed = Number(input)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export default class TeacherCreditsController {
  /** School admin: list teacher pools + institution budget breakdown */
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

    const [breakdown, teachers] = await Promise.all([
      getInstitutionBudgetBreakdown(user.institutionId),
      listTeacherCreditPoolsForInstitution(user.institutionId),
    ])

    return {
      data: {
        breakdown,
        teachers,
      },
    }
  }

  /** School admin: split budget equally among all teachers */
  async allocateEqual({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(allocateEqualTeacherCreditsValidator)
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

    try {
      const result = await allocateEqualToAllTeachers({
        institutionId: user.institutionId,
        totalAmount: payload.totalAmount,
        actorUserId: user.id,
        notes: payload.notes ?? null,
      })

      const breakdown = await getInstitutionBudgetBreakdown(user.institutionId)
      const teachers = await listTeacherCreditPoolsForInstitution(user.institutionId)

      return {
        data: {
          ...result,
          breakdown,
          teachers,
        },
      }
    } catch (error) {
      if (error instanceof InsufficientInstitutionBudgetToAssignError) {
        return response.unprocessableEntity({
          error: {
            code: error.code,
            message: 'El monto supera el presupuesto disponible para asignar',
            details: {
              availableToAssign: error.availableToAssign,
              requestedCredits: error.requested,
            },
            requestId: request.id(),
          },
        })
      }
      if (error instanceof Error && error.message === 'No teachers found in institution') {
        return response.unprocessableEntity({
          error: {
            code: 'NO_TEACHERS_IN_INSTITUTION',
            message: 'No hay docentes en la institución',
            requestId: request.id(),
          },
        })
      }
      if (
        error instanceof Error &&
        error.message === 'Total amount too small to split among teachers'
      ) {
        return response.unprocessableEntity({
          error: {
            code: 'ALLOCATION_TOO_SMALL',
            message: 'El monto es insuficiente para repartir entre los docentes',
            requestId: request.id(),
          },
        })
      }
      throw error
    }
  }

  /** School admin: assign budget to a specific teacher */
  async allocateToTeacher({ auth, request, response, params }: HttpContext) {
    const payload = await request.validateUsing(allocateTeacherCreditsValidator)
    const user = auth.getUserOrFail()
    const teacherId = parseTeacherId(params.teacherId)

    if (!user.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Institution scope required',
          requestId: request.id(),
        },
      })
    }

    if (!teacherId) {
      return response.badRequest({
        error: {
          code: 'INVALID_TEACHER_ID',
          message: 'Teacher id is invalid',
          requestId: request.id(),
        },
      })
    }

    try {
      const summary = await allocateToTeacher({
        institutionId: user.institutionId,
        teacherId,
        amount: payload.amount,
        actorUserId: user.id,
        notes: payload.notes ?? null,
      })

      const breakdown = await getInstitutionBudgetBreakdown(user.institutionId)

      return {
        data: {
          teacher: summary,
          breakdown,
        },
      }
    } catch (error) {
      if (error instanceof InsufficientInstitutionBudgetToAssignError) {
        return response.unprocessableEntity({
          error: {
            code: error.code,
            message: 'El monto supera el presupuesto disponible para asignar',
            details: {
              availableToAssign: error.availableToAssign,
              requestedCredits: error.requested,
            },
            requestId: request.id(),
          },
        })
      }
      if (error instanceof Error && error.message === 'Teacher not found in institution') {
        return response.notFound({
          error: {
            code: 'TEACHER_NOT_FOUND',
            message: 'Docente no encontrado en la institución',
            requestId: request.id(),
          },
        })
      }
      throw error
    }
  }

  /** Teacher: view own credit pool */
  async showMine({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const summary = await getTeacherCreditPoolSummary(user.id)
    if (!summary) {
      return {
        data: {
          teacherId: user.id,
          institutionId: user.institutionId,
          allocatedCredits: 0,
          utilizedCredits: 0,
          remainingCredits: 0,
          hasPool: false,
          lastAllocationAt: null,
        },
      }
    }

    if (user.institutionId && summary.institutionId !== user.institutionId) {
      return response.forbidden({
        error: {
          code: 'TENANT_SCOPE_VIOLATION',
          message: 'Cross-tenant access is not allowed',
          requestId: request.id(),
        },
      })
    }

    return { data: summary }
  }
}
