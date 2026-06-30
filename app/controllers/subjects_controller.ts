import { createSubjectValidator } from '#validators/school_group'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

type DbErrorWithCode = Error & { code?: string }

function isUniqueConstraintError(code: string | undefined): boolean {
  return code === '23505' || code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT'
}

export default class SubjectsController {
  async index({ auth, response }: HttpContext) {
    const actor = auth.getUserOrFail()

    if (!actor.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'School admin must belong to an institution',
        },
      })
    }

    const rows = await db
      .from('subjects')
      .where('institution_id', actor.institutionId)
      .orderBy('name', 'asc')

    return {
      data: rows.map((row) => ({
        id: row.id,
        institutionId: row.institution_id,
        name: row.name,
        code: row.code,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    }
  }

  async store({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(createSubjectValidator)
    const actor = auth.getUserOrFail()

    if (!actor.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'School admin must belong to an institution',
        },
      })
    }

    try {
      const inserted = await db
        .table('subjects')
        .insert({
          institution_id: actor.institutionId,
          name: payload.name,
          code: payload.code ?? null,
          status: 'active',
          created_at: new Date(),
          updated_at: null,
        })
        .returning('*')

      const rawRow = inserted[0] as Record<string, unknown> | number
      const row =
        typeof rawRow === 'number'
          ? {
              id: rawRow,
              institution_id: actor.institutionId,
              name: payload.name,
              code: payload.code ?? null,
              status: 'active',
              created_at: new Date(),
              updated_at: null,
            }
          : rawRow
      return {
        data: {
          id: row.id,
          institutionId: row.institution_id,
          name: row.name,
          code: row.code,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      }
    } catch (error) {
      const dbError = error as DbErrorWithCode
      if (isUniqueConstraintError(dbError.code)) {
        return response.conflict({
          error: {
            code: 'SUBJECT_CODE_TAKEN',
            message: 'Subject code already exists',
          },
        })
      }
      throw error
    }
  }
}
