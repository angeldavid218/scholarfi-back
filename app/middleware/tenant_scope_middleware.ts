import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

const SCHOOL_ROLES = new Set(['school_admin', 'teacher', 'student'])

function parseInstitutionId(input: unknown): number | null {
  if (input === null || input === undefined || input === '') {
    return null
  }
  const parsed = Number(input)
  return Number.isNaN(parsed) ? null : parsed
}

export default class TenantScopeMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()

    const roleRows = await db
      .from('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .where('user_roles.user_id', user.id)
      .select('roles.key')

    const userRoles = roleRows.map((row) => row.key)
    const isSchoolRole = userRoles.some((role) => SCHOOL_ROLES.has(role))
    if (!isSchoolRole) {
      return next()
    }

    const scopedInstitutionId =
      parseInstitutionId(ctx.request.input('institution_id')) ??
      parseInstitutionId(ctx.request.input('institutionId')) ??
      parseInstitutionId(ctx.request.param('institution_id')) ??
      parseInstitutionId(ctx.request.param('institutionId'))

    if (scopedInstitutionId !== null && scopedInstitutionId !== user.institutionId) {
      return ctx.response.forbidden({
        error: {
          code: 'TENANT_SCOPE_VIOLATION',
          message: 'Cross-tenant access is not allowed',
          requestId: ctx.request.id(),
        },
      })
    }

    return next()
  }
}
