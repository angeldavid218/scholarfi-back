import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

type RoleGuardOptions = {
  roles?: string[]
}

export default class RoleGuardMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: RoleGuardOptions = {}) {
    const allowedRoles = options.roles ?? []

    if (allowedRoles.length === 0) {
      return next()
    }

    const user = ctx.auth.getUserOrFail()
    const roleRows = await db
      .from('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .where('user_roles.user_id', user.id)
      .select('roles.key')

    const hasAllowedRole = roleRows.some((row) => allowedRoles.includes(row.key))

    if (!hasAllowedRole) {
      return ctx.response.forbidden({
        error: {
          code: 'FORBIDDEN_ROLE',
          message: 'Insufficient role permissions',
          requestId: ctx.request.id(),
        },
      })
    }

    return next()
  }
}
