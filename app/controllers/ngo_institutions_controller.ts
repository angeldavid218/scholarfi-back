import NgoInstitution from '#models/ngo_institution'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import {
  assignNgoUserValidator,
  bootstrapNgoAdminValidator,
  createNgoInstitutionValidator,
  updateNgoStatusValidator,
} from '#validators/ngo_institution'
import type { HttpContext } from '@adonisjs/core/http'

type DbErrorWithCode = Error & { code?: string }

function isUniqueConstraintError(code: string | undefined): boolean {
  return code === '23505' || code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT'
}

export default class NgoInstitutionsController {
  async index() {
    const rows = await NgoInstitution.query().orderBy('id', 'desc')

    return {
      data: rows.map((ngo) => ({
        id: ngo.id,
        name: ngo.name,
        code: ngo.code,
        status: ngo.status,
        createdAt: ngo.createdAt,
        updatedAt: ngo.updatedAt,
      })),
    }
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createNgoInstitutionValidator)

    try {
      const ngo = await NgoInstitution.create({
        name: payload.name,
        code: payload.code,
        status: payload.status ?? true,
      })

      return {
        data: {
          id: ngo.id,
          name: ngo.name,
          code: ngo.code,
          status: ngo.status,
          createdAt: ngo.createdAt,
          updatedAt: ngo.updatedAt,
        },
      }
    } catch (error) {
      const dbError = error as DbErrorWithCode
      if (isUniqueConstraintError(dbError.code)) {
        return response.conflict({
          error: {
            code: 'NGO_INSTITUTION_CODE_TAKEN',
            message: 'NGO Institution code already exists',
            details: {
              field: 'code',
              value: payload.code,
            },
            requestId: request.id(),
          },
        })
      }

      throw error
    }
  }

  async updateStatus({ request, response, params }: HttpContext) {
    const payload = await request.validateUsing(updateNgoStatusValidator)
    const ngoId = Number(params.id)
    const ngo = await NgoInstitution.find(ngoId)

    if (!ngo) {
      return response.notFound({
        error: {
          code: 'NGO_INSTITUTION_NOT_FOUND',
          message: 'NGO Institution not found',
          requestId: request.id(),
        },
      })
    }

    ngo.status = payload.status
    await ngo.save()

    return {
      data: {
        id: ngo.id,
        name: ngo.name,
        code: ngo.code,
        status: ngo.status,
        createdAt: ngo.createdAt,
        updatedAt: ngo.updatedAt,
      },
    }
  }

  async bootstrapNgoAdmin({ request, response, params }: HttpContext) {
    const payload = await request.validateUsing(bootstrapNgoAdminValidator)
    const ngoId = Number(params.id)
    const ngo = await NgoInstitution.find(ngoId)

    if (!ngo) {
      return response.notFound({
        error: {
          code: 'NGO_INSTITUTION_NOT_FOUND',
          message: 'NGO Institution not found',
          requestId: request.id(),
        },
      })
    }

    try {
      const user = await db.transaction(async (trx) => {
        const createdUser = await User.create(
          {
            fullName: payload.fullName,
            email: payload.email,
            password: payload.password,
            ngoInstitutionId: ngo.id,
            isActive: true,
          },
          { client: trx }
        )

        let ngoAdminRole = await trx.from('roles').where('key', 'ngo_admin').first()
        if (!ngoAdminRole) {
          const inserted = await trx
            .table('roles')
            .insert({
              key: 'ngo_admin',
              label: 'NGO Admin',
              created_at: new Date(),
              updated_at: null,
            })
            .returning('id')
          ngoAdminRole = {
            id: typeof inserted[0] === 'number' ? inserted[0] : (inserted[0] as any).id,
          }
        }

        await trx.table('user_roles').insert({
          user_id: createdUser.id,
          role_id: ngoAdminRole.id,
          created_at: new Date(),
          updated_at: null,
        })

        return createdUser
      })

      return {
        data: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          ngoInstitutionId: user.ngoInstitutionId,
          isActive: user.isActive,
          role: 'ngo_admin',
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      }
    } catch (error) {
      const dbError = error as DbErrorWithCode
      if (isUniqueConstraintError(dbError.code)) {
        return response.conflict({
          error: {
            code: 'EMAIL_TAKEN',
            message: 'Email already exists',
            details: {
              field: 'email',
              value: payload.email,
            },
            requestId: request.id(),
          },
        })
      }
      throw error
    }
  }

  async assignUser({ request, response, params }: HttpContext) {
    const payload = await request.validateUsing(assignNgoUserValidator)
    const ngoId = Number(params.id)

    const [ngo, targetUser] = await Promise.all([
      NgoInstitution.find(ngoId),
      User.find(payload.userId),
    ])

    if (!ngo) {
      return response.notFound({
        error: {
          code: 'NGO_INSTITUTION_NOT_FOUND',
          message: 'NGO Institution not found',
          requestId: request.id(),
        },
      })
    }

    if (!targetUser) {
      return response.notFound({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          requestId: request.id(),
        },
      })
    }

    const userRole = await db
      .from('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .where('user_roles.user_id', targetUser.id)
      .andWhere('roles.key', 'ngo_admin')
      .first()

    if (!userRole) {
      return response.unprocessableEntity({
        error: {
          code: 'USER_NOT_NGO_ADMIN',
          message: 'Target user must have the ngo_admin role',
          requestId: request.id(),
        },
      })
    }

    targetUser.ngoInstitutionId = ngo.id
    await targetUser.save()

    return {
      data: {
        userId: targetUser.id,
        ngoInstitutionId: targetUser.ngoInstitutionId,
        role: 'ngo_admin',
      },
    }
  }
}
