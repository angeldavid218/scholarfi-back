import Institution from '#models/institution'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import {
  bootstrapSchoolAdminValidator,
  createInstitutionValidator,
  assignInstitutionUserRoleValidator,
  provisionInstitutionUserValidator,
  upsertTeacherStudentAssociationValidator,
  updateInstitutionStatusValidator,
} from '#validators/institution'
import type { HttpContext } from '@adonisjs/core/http'

type DbErrorWithCode = Error & { code?: string }

export default class InstitutionsController {
  async index() {
    const rows = await Institution.query().orderBy('created_at', 'desc').orderBy('id', 'desc')

    return {
      data: rows.map((institution) => ({
        id: institution.id,
        name: institution.name,
        code: institution.code,
        status: institution.status,
        createdAt: institution.createdAt,
        updatedAt: institution.updatedAt,
      })),
    }
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createInstitutionValidator)

    try {
      const institution = await Institution.create({
        name: payload.name,
        code: payload.code,
        status: 'draft',
      })

      return {
        data: {
          id: institution.id,
          name: institution.name,
          code: institution.code,
          status: institution.status,
          createdAt: institution.createdAt,
          updatedAt: institution.updatedAt,
        },
      }
    } catch (error) {
      const dbError = error as DbErrorWithCode
      if (dbError.code === '23505') {
        return response.conflict({
          error: {
            code: 'INSTITUTION_CODE_TAKEN',
            message: 'Institution code already exists',
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
    const payload = await request.validateUsing(updateInstitutionStatusValidator)
    const institutionId = Number(params.id)
    const institution = await Institution.find(institutionId)

    if (!institution) {
      return response.notFound({
        error: {
          code: 'INSTITUTION_NOT_FOUND',
          message: 'Institution not found',
          requestId: request.id(),
        },
      })
    }

    institution.status = payload.status
    await institution.save()

    return {
      data: {
        id: institution.id,
        name: institution.name,
        code: institution.code,
        status: institution.status,
        createdAt: institution.createdAt,
        updatedAt: institution.updatedAt,
      },
    }
  }

  async bootstrapSchoolAdmin({ request, response, params }: HttpContext) {
    const payload = await request.validateUsing(bootstrapSchoolAdminValidator)
    const institutionId = Number(params.id)
    const institution = await Institution.find(institutionId)

    if (!institution) {
      return response.notFound({
        error: {
          code: 'INSTITUTION_NOT_FOUND',
          message: 'Institution not found',
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
            institutionId: institution.id,
            isActive: true,
          },
          { client: trx }
        )

        let schoolAdminRole = await trx.from('roles').where('key', 'school_admin').first()
        if (!schoolAdminRole) {
          const inserted = await trx
            .table('roles')
            .insert({
              key: 'school_admin',
              label: 'School Admin',
              created_at: new Date(),
              updated_at: null,
            })
            .returning('id')
          schoolAdminRole = {
            id: typeof inserted[0] === 'number' ? inserted[0] : (inserted[0] as any).id,
          }
        }

        await trx.table('user_roles').insert({
          user_id: createdUser.id,
          role_id: schoolAdminRole.id,
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
          institutionId: user.institutionId,
          isActive: user.isActive,
          role: 'school_admin',
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      }
    } catch (error) {
      const dbError = error as DbErrorWithCode
      if (dbError.code === '23505') {
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

  async provisionUser({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(provisionInstitutionUserValidator)
    const actor = auth.getUserOrFail()

    if (!actor.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'School admin must belong to an institution',
          requestId: request.id(),
        },
      })
    }

    const institution = await Institution.find(actor.institutionId)
    if (!institution) {
      return response.notFound({
        error: {
          code: 'INSTITUTION_NOT_FOUND',
          message: 'Institution not found',
          requestId: request.id(),
        },
      })
    }

    if (institution.status !== 'active') {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_INACTIVE',
          message: 'Institution must be active for user provisioning',
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
            institutionId: institution.id,
            isActive: true,
          },
          { client: trx }
        )

        let role = await trx.from('roles').where('key', payload.role).first()
        if (!role) {
          const label = payload.role === 'teacher' ? 'Teacher' : 'Student'
          const inserted = await trx
            .table('roles')
            .insert({
              key: payload.role,
              label,
              created_at: new Date(),
              updated_at: null,
            })
            .returning('id')
          role = { id: typeof inserted[0] === 'number' ? inserted[0] : (inserted[0] as any).id }
        }

        await trx.table('user_roles').insert({
          user_id: createdUser.id,
          role_id: role.id,
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
          institutionId: user.institutionId,
          isActive: user.isActive,
          role: payload.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      }
    } catch (error) {
      const dbError = error as DbErrorWithCode
      if (dbError.code === '23505') {
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

  async assignUserRole({ auth, request, response, params }: HttpContext) {
    const payload = await request.validateUsing(assignInstitutionUserRoleValidator)
    const actor = auth.getUserOrFail()
    const userId = Number(params.userId)

    if (!actor.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'School admin must belong to an institution',
          requestId: request.id(),
        },
      })
    }

    const targetUser = await User.find(userId)
    if (!targetUser || targetUser.institutionId !== actor.institutionId) {
      return response.forbidden({
        error: {
          code: 'TENANT_SCOPE_VIOLATION',
          message: 'Cross-tenant access is not allowed',
          requestId: request.id(),
        },
      })
    }

    const result = await db.transaction(async (trx) => {
      let role = await trx.from('roles').where('key', payload.role).first()
      if (!role) {
        const labelMap: Record<string, string> = {
          teacher: 'Teacher',
          student: 'Student',
          school_admin: 'School Admin',
        }
        const inserted = await trx
          .table('roles')
          .insert({
            key: payload.role,
            label: labelMap[payload.role],
            created_at: new Date(),
            updated_at: null,
          })
          .returning('id')
        role = { id: typeof inserted[0] === 'number' ? inserted[0] : (inserted[0] as any).id }
      }

      // MVP decision: role assignment is replace-all for the user (single effective role).
      await trx.from('user_roles').where('user_id', targetUser.id).del()
      await trx.table('user_roles').insert({
        user_id: targetUser.id,
        role_id: role.id,
        created_at: new Date(),
        updated_at: null,
      })

      return payload.role
    })

    return {
      data: {
        userId: targetUser.id,
        institutionId: targetUser.institutionId,
        role: result,
      },
    }
  }

  async upsertTeacherStudentAssociation({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(upsertTeacherStudentAssociationValidator)
    const actor = auth.getUserOrFail()

    if (!actor.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'School admin must belong to an institution',
          requestId: request.id(),
        },
      })
    }

    const [teacher, student] = await Promise.all([
      User.find(payload.teacherId),
      User.find(payload.studentId),
    ])
    const sameInstitution =
      teacher &&
      student &&
      teacher.institutionId === actor.institutionId &&
      student.institutionId === actor.institutionId

    if (!sameInstitution) {
      return response.forbidden({
        error: {
          code: 'TENANT_SCOPE_VIOLATION',
          message: 'Cross-tenant access is not allowed',
          requestId: request.id(),
        },
      })
    }

    await db
      .table('teacher_students')
      .insert({
        institution_id: actor.institutionId,
        teacher_id: payload.teacherId,
        student_id: payload.studentId,
        created_at: new Date(),
        updated_at: null,
      })
      .onConflict(['teacher_id', 'student_id'])
      .merge({
        institution_id: actor.institutionId,
        updated_at: new Date(),
      })

    return {
      data: {
        institutionId: actor.institutionId,
        teacherId: payload.teacherId,
        studentId: payload.studentId,
      },
    }
  }
}
