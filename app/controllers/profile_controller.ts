import Institution from '#models/institution'
import NgoInstitution from '#models/ngo_institution'
import db from '@adonisjs/lucid/services/db'
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

    let ngoInstitutionName: string | null = null
    if (user.ngoInstitutionId) {
      const ngo = await NgoInstitution.query()
        .where('id', user.ngoInstitutionId)
        .select('name')
        .first()
      ngoInstitutionName = ngo?.name ?? null
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
        ngoInstitutionId: user.ngoInstitutionId,
        ngoInstitutionName,
        roles: roleRows.map((row) => row.key),
      },
    }
  }
}
