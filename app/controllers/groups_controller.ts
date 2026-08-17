import { errors } from '@vinejs/vine'
import Institution from '#models/institution'
import User from '#models/user'
import { importGroupsFromCsv } from '#services/group_csv_import_service'
import {
  csvImportLogInfo,
  csvImportLogWarn,
} from '#services/group_csv_import_logger'
import {
  findOrCreateGroup,
  upsertGroupStudent,
  upsertGroupTeacher,
} from '#services/group_upsert_service'
import { userHasRole } from '#services/role_query_service'
import { createGroupValidator, groupImportColumnMappingValidator, syncGroupMembersValidator } from '#validators/school_group'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import { readFile } from 'node:fs/promises'

function parseBooleanQuery(value: unknown): boolean {
  if (value === true || value === 'true' || value === '1') return true
  return false
}

function mapGroupRow(row: Record<string, unknown>, studentCount?: number) {
  return {
    id: row.id,
    institutionId: row.institution_id ?? row.institutionId,
    subjectId: row.subject_id ?? row.subjectId,
    subjectName: row.subject_name ?? row.subjectName ?? null,
    name: row.name,
    section: row.section ?? null,
    code: row.code ?? null,
    status: row.status,
    externalSource: row.external_source ?? row.externalSource,
    externalId: row.external_id ?? row.externalId ?? null,
    studentCount: studentCount ?? null,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  }
}

export default class GroupsController {
  async mine({ auth, response }: HttpContext) {
    const teacher = auth.getUserOrFail()

    if (!teacher.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Teacher must belong to an institution',
        },
      })
    }

    const isTeacher = await userHasRole(teacher.id, 'teacher')
    if (!isTeacher) {
      return response.forbidden({
        error: {
          code: 'ROLE_REQUIRED',
          message: 'Teacher role is required',
        },
      })
    }

    const rows = await db
      .from('groups')
      .innerJoin('group_teachers', 'group_teachers.group_id', 'groups.id')
      .innerJoin('subjects', 'subjects.id', 'groups.subject_id')
      .where('group_teachers.teacher_id', teacher.id)
      .where('groups.institution_id', teacher.institutionId)
      .select(
        'groups.*',
        'subjects.name as subject_name',
        db.raw(
          `(SELECT COUNT(*) FROM group_students WHERE group_students.group_id = groups.id) as student_count`
        )
      )
      .orderBy('groups.name', 'asc')

    return {
      data: rows.map((row) =>
        mapGroupRow(row as Record<string, unknown>, Number(row.student_count ?? 0))
      ),
    }
  }

  async importCsv({ auth, request, response }: HttpContext) {
    const teacher = auth.getUserOrFail()

    if (!teacher.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Teacher must belong to an institution',
        },
      })
    }

    const isTeacher = await userHasRole(teacher.id, 'teacher')
    if (!isTeacher) {
      return response.forbidden({
        error: {
          code: 'ROLE_REQUIRED',
          message: 'Teacher role is required',
        },
      })
    }

    const institution = await Institution.find(teacher.institutionId)
    if (!institution || institution.status !== 'active') {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_INACTIVE',
          message: 'Institution must be active',
        },
      })
    }

    const csvFile = request.file('file', {
      size: '2mb',
      extnames: ['csv', 'txt'],
    })

    if (!csvFile || !csvFile.isValid || !csvFile.tmpPath) {
      csvImportLogWarn(
        'CSV import rejected: invalid file upload',
        {
          requestId: request.id(),
          institutionId: teacher.institutionId,
          teacherId: teacher.id,
        },
        {
          isValid: csvFile?.isValid ?? false,
          error: csvFile?.errors[0]?.message ?? null,
        }
      )
      return response.badRequest({
        error: {
          code: 'INVALID_CSV_FILE',
          message: csvFile?.errors[0]?.message ?? 'A valid CSV file is required',
        },
      })
    }

    const csvContent = await readFile(csvFile.tmpPath, 'utf-8')
    const dryRun = parseBooleanQuery(request.input('dryRun'))

    csvImportLogInfo(
      dryRun ? 'CSV import request received (dry-run)' : 'CSV import request received',
      {
        requestId: request.id(),
        institutionId: teacher.institutionId,
        teacherId: teacher.id,
        filename: csvFile.clientName,
        dryRun,
      },
      { fileSize: csvFile.size }
    )

    let columnMapping: Record<string, string> | undefined
    const mappingRaw = request.input('columnMapping')
    if (mappingRaw !== undefined && mappingRaw !== null && mappingRaw !== '') {
      let parsedMapping: unknown = mappingRaw
      if (typeof mappingRaw === 'string') {
        try {
          parsedMapping = JSON.parse(mappingRaw)
        } catch {
          return response.badRequest({
            error: {
              code: 'INVALID_COLUMN_MAPPING',
              message: 'columnMapping must be valid JSON',
            },
          })
        }
      }

      try {
        columnMapping = await groupImportColumnMappingValidator.validate(parsedMapping)
      } catch (error) {
        if (error instanceof errors.E_VALIDATION_ERROR) {
          return response.unprocessableEntity(error.messages)
        }
        throw error
      }
    }

    const result = await importGroupsFromCsv({
      institutionId: teacher.institutionId,
      teacherId: teacher.id,
      filename: csvFile.clientName,
      csvContent,
      dryRun,
      columnMapping,
      requestId: request.id(),
    })

    return {
      data: {
        runId: result.runId,
        dryRun,
        summary: result.summary,
      },
    }
  }

  async listImportRuns({ auth, response }: HttpContext) {
    const teacher = auth.getUserOrFail()

    if (!teacher.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Teacher must belong to an institution',
        },
      })
    }

    const rows = await db
      .from('group_import_runs')
      .where('institution_id', teacher.institutionId)
      .where('uploaded_by_teacher_id', teacher.id)
      .orderBy('created_at', 'desc')
      .limit(50)

    return {
      data: rows.map((row) => ({
        id: row.id,
        filename: row.filename,
        status: row.status,
        createdAt: row.created_at,
      })),
    }
  }

  async showImportRun({ auth, params, response }: HttpContext) {
    const teacher = auth.getUserOrFail()
    const runId = Number(params.id)

    if (!teacher.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Teacher must belong to an institution',
        },
      })
    }

    const row = await db
      .from('group_import_runs')
      .where('id', runId)
      .where('institution_id', teacher.institutionId)
      .where('uploaded_by_teacher_id', teacher.id)
      .first()

    if (!row) {
      return response.notFound({
        error: {
          code: 'IMPORT_RUN_NOT_FOUND',
          message: 'Import run not found',
        },
      })
    }

    let summary = null
    if (row.summary_json) {
      summary =
        typeof row.summary_json === 'string' ? JSON.parse(row.summary_json) : row.summary_json
    }

    return {
      data: {
        id: row.id,
        filename: row.filename,
        status: row.status,
        summary,
        createdAt: row.created_at,
      },
    }
  }

  async syncTeachers({ auth, request, response, params }: HttpContext) {
    return this.syncMembers({ auth, request, response, params, memberRole: 'teacher' })
  }

  async syncStudents({ auth, request, response, params }: HttpContext) {
    return this.syncMembers({ auth, request, response, params, memberRole: 'student' })
  }

  private async syncMembers(ctx: {
    auth: HttpContext['auth']
    request: HttpContext['request']
    response: HttpContext['response']
    params: HttpContext['params']
    memberRole: 'teacher' | 'student'
  }) {
    const payload = await ctx.request.validateUsing(syncGroupMembersValidator)
    const actor = ctx.auth.getUserOrFail()
    const groupId = Number(ctx.params.id)

    if (!actor.institutionId) {
      return ctx.response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'School admin must belong to an institution',
        },
      })
    }

    const group = await db
      .from('groups')
      .where('id', groupId)
      .where('institution_id', actor.institutionId)
      .first()

    if (!group) {
      return ctx.response.notFound({
        error: {
          code: 'GROUP_NOT_FOUND',
          message: 'Group not found',
        },
      })
    }

    for (const userId of payload.userIds) {
      const user = await User.find(userId)
      if (!user || user.institutionId !== actor.institutionId) {
        return ctx.response.forbidden({
          error: {
            code: 'TENANT_SCOPE_VIOLATION',
            message: 'Cross-tenant access is not allowed',
          },
        })
      }

      const hasRole = await userHasRole(userId, ctx.memberRole)
      if (!hasRole) {
        return ctx.response.badRequest({
          error: {
            code: 'INVALID_MEMBER_ROLE',
            message: `User ${userId} is not a ${ctx.memberRole}`,
          },
        })
      }

      if (ctx.memberRole === 'teacher') {
        await upsertGroupTeacher({
          institutionId: actor.institutionId,
          groupId,
          teacherId: userId,
        })
      } else {
        await upsertGroupStudent({
          institutionId: actor.institutionId,
          groupId,
          studentId: userId,
        })
      }
    }

    return {
      data: {
        groupId,
        memberRole: ctx.memberRole,
        userIds: payload.userIds,
      },
    }
  }

  async storeForInstitution({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(createGroupValidator)
    const actor = auth.getUserOrFail()

    if (!actor.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'School admin must belong to an institution',
        },
      })
    }

    const subject = await db
      .from('subjects')
      .where('id', payload.subjectId)
      .where('institution_id', actor.institutionId)
      .first()

    if (!subject) {
      return response.notFound({
        error: {
          code: 'SUBJECT_NOT_FOUND',
          message: 'Subject not found',
        },
      })
    }

    if (!payload.name && !payload.section) {
      return response.badRequest({
        error: {
          code: 'GROUP_IDENTITY_REQUIRED',
          message: 'Either name or section is required',
        },
      })
    }

    const group = await findOrCreateGroup({
      institutionId: actor.institutionId,
      subjectId: payload.subjectId,
      subjectName: subject.name as string,
      section: payload.section ?? null,
      className: payload.name ?? null,
      externalSource: 'manual',
      createdByTeacherId: null,
    })

    return {
      data: mapGroupRow(group as Record<string, unknown>),
    }
  }

  async indexForInstitution({ auth, response }: HttpContext) {
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
      .from('groups')
      .innerJoin('subjects', 'subjects.id', 'groups.subject_id')
      .where('groups.institution_id', actor.institutionId)
      .select(
        'groups.*',
        'subjects.name as subject_name',
        db.raw(
          `(SELECT COUNT(*) FROM group_students WHERE group_students.group_id = groups.id) as student_count`
        )
      )
      .orderBy('groups.name', 'asc')

    return {
      data: rows.map((row) =>
        mapGroupRow(row as Record<string, unknown>, Number(row.student_count ?? 0))
      ),
    }
  }
}
