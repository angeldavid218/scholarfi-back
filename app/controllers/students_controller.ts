import User from '#models/user'
import { makeTokenService } from '#services/tokens/factory'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

function parseId(input: unknown): number | null {
  const parsed = Number(input)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export default class StudentsController {
  async showBalance({ auth, request, response, params }: HttpContext) {
    const actor = auth.getUserOrFail()
    const studentId = parseId(params.studentId)
    if (!studentId) {
      return response.badRequest({
        error: {
          code: 'INVALID_STUDENT_ID',
          message: 'Student id is invalid',
          requestId: request.id(),
        },
      })
    }

    if (!actor.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Institution scope required',
          requestId: request.id(),
        },
      })
    }

    const student = await User.query()
      .where('id', studentId)
      .andWhere('institution_id', actor.institutionId)
      .first()

    if (!student) {
      return response.forbidden({
        error: {
          code: 'TENANT_SCOPE_VIOLATION',
          message: 'Cross-tenant access is not allowed',
          requestId: request.id(),
        },
      })
    }

    const roleRow = await db
      .from('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .where('user_roles.user_id', studentId)
      .where('roles.key', 'student')
      .first()

    if (!roleRow) {
      return response.forbidden({
        error: {
          code: 'NOT_A_STUDENT',
          message: 'User is not a student in this institution',
          requestId: request.id(),
        },
      })
    }

    const tokenService = await makeTokenService()
    const balance = await tokenService.getBalance(String(studentId))

    return {
      data: {
        institutionId: actor.institutionId,
        studentId,
        simulatedBalance: balance,
      },
    }
  }

  async listTransactions({ auth, request, response, params }: HttpContext) {
    const actor = auth.getUserOrFail()
    const studentId = parseId(params.studentId)
    if (!studentId) {
      return response.badRequest({
        error: {
          code: 'INVALID_STUDENT_ID',
          message: 'Student id is invalid',
          requestId: request.id(),
        },
      })
    }

    if (!actor.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Institution scope required',
          requestId: request.id(),
        },
      })
    }

    const student = await User.query()
      .where('id', studentId)
      .andWhere('institution_id', actor.institutionId)
      .first()

    if (!student) {
      return response.forbidden({
        error: {
          code: 'TENANT_SCOPE_VIOLATION',
          message: 'Cross-tenant access is not allowed',
          requestId: request.id(),
        },
      })
    }

    const tokenService = await makeTokenService()
    const items = await tokenService.getTransactionHistory(String(studentId), actor.institutionId)

    return {
      data: {
        items: items.map((t) => ({
          id: t.id,
          institutionId: t.institutionId,
          achievementId: t.achievementId,
          redemptionId: t.redemptionId,
          amount: t.amount,
          type: t.type,
          status: t.status,
          provider: t.provider,
          transactionSignature: t.transactionSignature,
          createdAt: t.createdAt,
        })),
      },
    }
  }
}
