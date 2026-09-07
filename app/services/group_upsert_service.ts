import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import { maybeCreateStudentWallet } from '#services/institution_crypto_wallets_service'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { randomBytes } from 'node:crypto'

export type GroupExternalSource = 'manual' | 'csv_import' | 'google_classroom' | 'moodle' | 'cloud_campus'

function normalizeSubjectName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function buildGroupDisplayName(
  subjectName: string,
  section: string | null,
  className: string | null
): string {
  if (className && className.length > 0) return className

  const normalizedSubject = normalizeSubjectName(subjectName)
  const normalizedSection = section?.trim() || null

  if (normalizedSection) {
    if (normalizedSubject.toLowerCase().endsWith(normalizedSection.toLowerCase())) {
      return normalizedSubject
    }
    return `${normalizedSubject} ${normalizedSection}`
  }

  return normalizedSubject
}

export async function findInstitutionGroup(
  input: {
    institutionId: number
    subjectId: number
    subjectName: string
    section: string | null
    className: string | null
  },
  trx?: TransactionClientContract
) {
  const section = input.section?.trim() || null
  const className = input.className?.trim() || null
  const displayName = buildGroupDisplayName(input.subjectName, section, className)

  const baseQuery = () => {
    let query = db
      .from('groups')
      .where('institution_id', input.institutionId)
      .where('subject_id', input.subjectId)

    if (trx) query = query.useTransaction(trx)
    return query
  }

  if (section) {
    const bySection = await baseQuery().where('section', section).orderBy('id', 'asc').first()
    if (bySection) return bySection
  }

  if (className) {
    const byClassName = await baseQuery().whereILike('name', className).first()
    if (byClassName) return byClassName
  }

  const byDisplayName = await baseQuery().whereILike('name', displayName).first()
  if (byDisplayName) return byDisplayName

  if (!section) {
    const byNameOnly = await baseQuery().where('name', displayName).first()
    if (byNameOnly) return byNameOnly
  }

  if (className || section) {
    let fallback = db
      .from('groups')
      .where('institution_id', input.institutionId)

    if (trx) fallback = fallback.useTransaction(trx)

    if (section) {
      fallback = fallback.where('section', section)
    }

    if (className) {
      fallback = fallback.whereILike('name', className)
    } else {
      fallback = fallback.whereILike('name', displayName)
    }

    const crossSubjectMatch = await fallback.orderBy('id', 'asc').first()
    if (crossSubjectMatch) return crossSubjectMatch
  }

  return null
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

  const existing = await findInstitutionGroup(
    {
      institutionId: input.institutionId,
      subjectId: input.subjectId,
      subjectName: input.subjectName,
      section,
      className,
    },
    trx
  )
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

export interface InstitutionStudentRow {
  id: number
  email: string
  fullName: string | null
  registrationNumber: string | null
  googleClassroomUserId?: string | null
}

export type FindOrCreateStudentResult =
  | { ok: true; student: InstitutionStudentRow; created: boolean }
  | { ok: false; message: string }

export function normalizeRegistrationNumber(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export async function ensureStudentRoleId(trx?: TransactionClientContract): Promise<number> {
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
    .select(
      'users.id as id',
      'users.email as email',
      'users.full_name as fullName',
      'users.registration_number as registrationNumber',
      'users.google_classroom_user_id as googleClassroomUserId'
    )

  if (trx) query = query.useTransaction(trx)

  const row = await query.first()
  return row ? (row as InstitutionStudentRow) : null
}

async function findRegistrationNumberConflict(
  institutionId: number,
  registrationNumber: string,
  excludeUserId?: number,
  trx?: TransactionClientContract
): Promise<boolean> {
  let query = db
    .from('users')
    .where('institution_id', institutionId)
    .whereRaw('LOWER(registration_number) = ?', [registrationNumber.toLowerCase()])

  if (excludeUserId != null) {
    query = query.whereNot('id', excludeUserId)
  }
  if (trx) query = query.useTransaction(trx)

  const row = await query.first()
  return row !== undefined && row !== null
}

async function backfillStudentRegistrationNumber(
  student: InstitutionStudentRow,
  registrationNumber: string | null,
  institutionId: number,
  dryRun: boolean
): Promise<FindOrCreateStudentResult> {
  if (!registrationNumber) {
    return { ok: true, student, created: false }
  }

  const existingNumber = normalizeRegistrationNumber(student.registrationNumber)
  if (existingNumber) {
    if (existingNumber.toLowerCase() !== registrationNumber.toLowerCase()) {
      return {
        ok: false,
        message: `Registration number mismatch for ${student.email}`,
      }
    }
    return { ok: true, student, created: false }
  }

  const conflict = await findRegistrationNumberConflict(
    institutionId,
    registrationNumber,
    student.id
  )
  if (conflict) {
    return {
      ok: false,
      message: `Registration number already used: ${registrationNumber}`,
    }
  }

  if (!dryRun) {
    await db
      .from('users')
      .where('id', student.id)
      .update({
        registration_number: registrationNumber,
        updated_at: new Date(),
      })
  }

  return {
    ok: true,
    student: { ...student, registrationNumber },
    created: false,
  }
}

export async function findOrCreateInstitutionStudent(input: {
  institutionId: number
  email: string
  fullName: string | null
  registrationNumber?: string | null
  dryRun: boolean
  pendingCreatedEmails?: Set<string>
  pendingCreatedRegistrationNumbers?: Set<string>
}): Promise<FindOrCreateStudentResult> {
  const normalizedEmail = input.email.trim().toLowerCase()
  const registrationNumber = normalizeRegistrationNumber(input.registrationNumber)

  const existing = await findInstitutionStudentByEmail(input.institutionId, normalizedEmail)
  if (existing) {
    return backfillStudentRegistrationNumber(
      existing,
      registrationNumber,
      input.institutionId,
      input.dryRun
    )
  }

  if (input.dryRun && input.pendingCreatedEmails?.has(normalizedEmail)) {
    return {
      ok: true,
      student: {
        id: 0,
        email: normalizedEmail,
        fullName: input.fullName,
        registrationNumber,
      },
      created: false,
    }
  }

  if (!registrationNumber) {
    return {
      ok: false,
      message: `Registration number is required for new student: ${normalizedEmail}`,
    }
  }

  const pendingKey = registrationNumber.toLowerCase()
  if (input.dryRun && input.pendingCreatedRegistrationNumbers?.has(pendingKey)) {
    return {
      ok: false,
      message: `Registration number already used: ${registrationNumber}`,
    }
  }

  const conflict = await findRegistrationNumberConflict(input.institutionId, registrationNumber)
  if (conflict) {
    return {
      ok: false,
      message: `Registration number already used: ${registrationNumber}`,
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
    input.pendingCreatedRegistrationNumbers?.add(pendingKey)
    return {
      ok: true,
      student: {
        id: 0,
        email: normalizedEmail,
        fullName: input.fullName,
        registrationNumber,
      },
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
        isActive: false,
        accountStatus: 'pending',
        registrationNumber,
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

  await maybeCreateStudentWallet(input.institutionId, createdUser.id)

  return {
    ok: true,
    student: {
      id: createdUser.id,
      email: createdUser.email,
      fullName: createdUser.fullName,
      registrationNumber: createdUser.registrationNumber,
    },
    created: true,
  }
}
