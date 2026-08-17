import Institution from '#models/institution'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import { changePasswordValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class ProfileController {
  async show({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const roleRows = await db
      .from('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .where('user_roles.user_id', user.id)
      .select('roles.key')

    let institutionName: string | null = null
    if (user.institutionId) {
      const institution = await Institution.query()
        .where('id', user.institutionId)
        .select('name')
        .first()
      institutionName = institution?.name ?? null
    }

    return {
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        initials: user.initials,
        institutionId: user.institutionId,
        institutionName,
        roles: roleRows.map((row) => row.key),
      },
    }
  }

  async updatePassword({ auth, request, response }: HttpContext) {
    const { currentPassword, password } = await request.validateUsing(changePasswordValidator)
    const user = auth.getUserOrFail()

    const currentValid = await hash.verify(user.password, currentPassword)
    if (!currentValid) {
      return response.badRequest({
        error: {
          code: 'CURRENT_PASSWORD_INVALID',
          message: 'Current password is incorrect',
          requestId: request.id(),
        },
      })
    }

    user.password = password
    await user.save()

    return {
      data: {
        updated: true,
      },
    }
  }
}
