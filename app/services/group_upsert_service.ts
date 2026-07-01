import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import { makeTokenService } from '#services/tokens/factory'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { randomBytes } from 'node:crypto'

export type GroupExternalSource = 'manual' | 'csv_import' | 'google_classroom' | 'moodle' | 'cloud_campus'

function normalizeSubjectName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function buildGroupDisplayName(subjectName: string, section: string | null, className: string | null): string {
  if (className && className.length > 0) return className
  if (section && section.length > 0) return `${subjectName} ${section}`
  return subjectName
}

export async function findOrCreateSubject(
  institutionId: number,
  subjectName: string,
  trx?: TransactionClientContract
) {
  const normalizedName = normalizeSubjectName(subjectName)
  const query = db.from('subjects').where('institution_id', institutionId)

  if (trx) query.useTransaction(trx)

  const existing = await query.whereILike('name', normalizedName).first()
  if (existing) return existing

  const insertQuery = db
    .table('subjects')
    .insert({
      institution_id: institutionId,
      name: normalizedName,
      code: null,
      status: 'active',
      created_at: new Date(),
      updated_at: null,
    })
    .returning('*')

  if (trx) insertQuery.useTransaction(trx)

  const inserted = await insertQuery
  const row = inserted[0] as Record<string, unknown> | number
  if (typeof row === 'number') {
    return {
      id: row,
      institution_id: institutionId,
      name: normalizedName,
    }
  }
  return row
}

export async function findOrCreateGroup(
  input: {
    institutionId: number
    subjectId: number
    subjectName: string
    section: string | null
    className: string | null
    externalSource: GroupExternalSource
    createdByTeacherId: number | null
  },
  trx?: TransactionClientContract
) {
  const section = input.section?.trim() || null
  const className = input.className?.trim() || null
  const displayName = buildGroupDisplayName(input.subjectName, section, className)

  let findQuery = db
    .from('groups')
    .where('institution_id', input.institutionId)
    .where('subject_id', input.subjectId)

  if (trx) findQuery = findQuery.useTransaction(trx)

  if (section) {
    findQuery = findQuery.where('section', section)
  } else {
    findQuery = findQuery.where('name', displayName)
  }

  const existing = await findQuery.first()
  if (existing) return existing

  const insertQuery = db
    .table('groups')
    .insert({
      institution_id: input.institutionId,
      subject_id: input.subjectId,
      name: displayName,
      section,
      code: null,
      sync_metadata: null,
      status: 'active',
      external_source: input.externalSource,
      external_id: null,
      created_by_teacher_id: input.createdByTeacherId,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('*')

  if (trx) insertQuery.useTransaction(trx)

  const inserted = await insertQuery
  const row = inserted[0] as Record<string, unknown> | number
  if (typeof row === 'number') {
    return {
      id: row,
      institution_id: input.institutionId,
      subject_id: input.subjectId,
      name: displayName,
      section,
    }
  }
  return row
}

export async function upsertGroupTeacher(
  input: {
    institutionId: number
    groupId: number
    teacherId: number
  },
  trx?: TransactionClientContract
) {
  const insertQuery = db
    .table('group_teachers')
    .insert({
      institution_id: input.institutionId,
      group_id: input.groupId,
      teacher_id: input.teacherId,
      created_at: new Date(),
      updated_at: null,
    })
    .onConflict(['group_id', 'teacher_id'])
    .merge({
      institution_id: input.institutionId,
      updated_at: new Date(),
    })

  if (trx) insertQuery.useTransaction(trx)
  await insertQuery
}

export async function upsertGroupStudent(
  input: {
    institutionId: number
    groupId: number
    studentId: number
  },
  trx?: TransactionClientContract
) {
  const insertQuery = db
    .table('group_students')
    .insert({
      institution_id: input.institutionId,
      group_id: input.groupId,
      student_id: input.studentId,
      created_at: new Date(),
      updated_at: null,
    })
    .onConflict(['group_id', 'student_id'])
    .merge({
      institution_id: input.institutionId,
      updated_at: new Date(),
    })

  if (trx) insertQuery.useTransaction(trx)
  await insertQuery
}

export type InstitutionStudentRow = {
  id: number
  email: string
  fullName: string | null
}

export type FindOrCreateStudentResult =
  | { ok: true; student: InstitutionStudentRow; created: boolean }
  | { ok: false; message: string }

async function ensureStudentRoleId(trx?: TransactionClientContract): Promise<number> {
  let query = db.from('roles').where('key', 'student')
  if (trx) query = query.useTransaction(trx)

  const existing = await query.first()
  if (existing) return existing.id as number

  const insertQuery = db
    .table('roles')
    .insert({
      key: 'student',
      label: 'Student',
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')

  if (trx) insertQuery.useTransaction(trx)

  const inserted = await insertQuery
  const row = inserted[0] as { id: number } | number
  return typeof row === 'number' ? row : row.id
}

export async function findInstitutionStudentByEmail(
  institutionId: number,
  email: string,
  trx?: TransactionClientContract
): Promise<InstitutionStudentRow | null> {
  const normalizedEmail = email.trim().toLowerCase()
  let query = db
    .from('users')
    .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
    .innerJoin('roles', 'roles.id', 'user_roles.role_id')
    .where('users.institution_id', institutionId)
    .where('roles.key', 'student')
    .whereRaw('LOWER(users.email) = ?', [normalizedEmail])
    .select('users.id as id', 'users.email as email', 'users.full_name as fullName')

  if (trx) query = query.useTransaction(trx)

  const row = await query.first()
  return row ? (row as InstitutionStudentRow) : null
}

export async function findOrCreateInstitutionStudent(input: {
  institutionId: number
  email: string
  fullName: string | null
  dryRun: boolean
  pendingCreatedEmails?: Set<string>
}): Promise<FindOrCreateStudentResult> {
  const normalizedEmail = input.email.trim().toLowerCase()
  const existing = await findInstitutionStudentByEmail(input.institutionId, normalizedEmail)
  if (existing) {
    return { ok: true, student: existing, created: false }
  }

  if (input.dryRun && input.pendingCreatedEmails?.has(normalizedEmail)) {
    return {
      ok: true,
      student: { id: 0, email: normalizedEmail, fullName: input.fullName },
      created: false,
    }
  }

  const globalUser = await db
    .from('users')
    .whereRaw('LOWER(email) = ?', [normalizedEmail])
    .first()

  if (globalUser) {
    if (globalUser.institution_id !== input.institutionId) {
      return {
        ok: false,
        message: `Email belongs to another institution: ${normalizedEmail}`,
      }
    }
    return {
      ok: false,
      message: `User exists in institution but is not a student: ${normalizedEmail}`,
    }
  }

  if (input.dryRun) {
    input.pendingCreatedEmails?.add(normalizedEmail)
    return {
      ok: true,
      student: { id: 0, email: normalizedEmail, fullName: input.fullName },
      created: true,
    }
  }

  const createdUser = await db.transaction(async (trx) => {
    const user = await User.create(
      {
        fullName: input.fullName,
        email: normalizedEmail,
        password: randomBytes(18).toString('base64url'),
        institutionId: input.institutionId,
        isActive: true,
      },
      { client: trx }
    )

    const roleId = await ensureStudentRoleId(trx)
    await trx.table('user_roles').insert({
      user_id: user.id,
      role_id: roleId,
      created_at: new Date(),
      updated_at: null,
    })

    return user
  })

  const tokenService = await makeTokenService()
  await tokenService.createWallet(String(createdUser.id))

  return {
    ok: true,
    student: {
      id: createdUser.id,
      email: createdUser.email,
      fullName: createdUser.fullName,
    },
    created: true,
  }
}
