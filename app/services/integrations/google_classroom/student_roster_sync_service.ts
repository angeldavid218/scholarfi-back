import googleClassroomConfig from '#config/google_classroom'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import {
  listGoogleClassroomCourseRoster,
  listGoogleClassroomCourses,
} from '#services/integrations/google_classroom/client'
import {
  persistClassroomUserIdsFromRoster,
  upsertGoogleClassroomGroup,
} from '#services/integrations/google_classroom/group_link_service'
import { upsertGroupStudent } from '#services/group_upsert_service'
import { maybeCreateStudentWallet } from '#services/institution_crypto_wallets_service'
import { gcLogInfo } from '#services/integrations/google_classroom/logger'

export type ClassroomStudentRosterSyncSummary = {
  courses: number
  created: number
  activated: number
  linked: number
  skipped: number
  errors: Array<{ email: string | null; message: string }>
}

async function ensureStudentRoleId(): Promise<number> {
  const existing = await db.from('roles').where('key', 'student').first()
  if (existing) return existing.id as number

  const inserted = await db
    .table('roles')
    .insert({
      key: 'student',
      label: 'Student',
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')

  const row = inserted[0] as { id: number } | number
  return typeof row === 'number' ? row : row.id
}

type StudentLookup = {
  id: number
  email: string
  accountStatus: string
  isActive: boolean
  isStudent: boolean
  institutionId: number | null
}

async function findUserByEmail(email: string): Promise<StudentLookup | null> {
  const row = await db
    .from('users')
    .whereRaw('LOWER(email) = ?', [email])
    .select(
      'users.id as id',
      'users.email as email',
      'users.account_status as accountStatus',
      'users.is_active as isActive',
      'users.institution_id as institutionId'
    )
    .first()

  if (!row) return null

  const role = await db
    .from('user_roles')
    .innerJoin('roles', 'roles.id', 'user_roles.role_id')
    .where('user_roles.user_id', row.id)
    .andWhere('roles.key', 'student')
    .first()

  return {
    id: row.id as number,
    email: row.email as string,
    accountStatus: (row.accountStatus as string) ?? 'active',
    isActive: Boolean(row.isActive),
    isStudent: Boolean(role),
    institutionId: (row.institutionId as number | null) ?? null,
  }
}

async function createActiveClassroomStudent(input: {
  institutionId: number
  email: string
  fullName: string | null
  password: string
}): Promise<number> {
  const roleId = await ensureStudentRoleId()

  const user = await db.transaction(async (trx) => {
    const created = await User.create(
      {
        fullName: input.fullName,
        email: input.email,
        password: input.password,
        institutionId: input.institutionId,
        isActive: true,
        accountStatus: 'active',
        registrationNumber: null,
      },
      { client: trx }
    )

    await trx.table('user_roles').insert({
      user_id: created.id,
      role_id: roleId,
      created_at: new Date(),
      updated_at: null,
    })

    return created
  })

  await maybeCreateStudentWallet(input.institutionId, user.id)
  return user.id
}

async function activatePendingStudent(userId: number, password: string): Promise<void> {
  const user = await User.findOrFail(userId)
  user.password = password
  user.accountStatus = 'active'
  user.isActive = true
  await user.save()
}

/**
 * Provision/link ScholarFi students from every Google Classroom course the teacher can list.
 */
export async function syncClassroomStudentsForTeacher(input: {
  teacherId: number
  institutionId: number
  refreshToken: string
}): Promise<ClassroomStudentRosterSyncSummary> {
  const summary: ClassroomStudentRosterSyncSummary = {
    courses: 0,
    created: 0,
    activated: 0,
    linked: 0,
    skipped: 0,
    errors: [],
  }

  const defaultPassword = googleClassroomConfig.studentDefaultPassword
  const courses = await listGoogleClassroomCourses(input.refreshToken)
  summary.courses = courses.length

  const processedEmails = new Set<string>()

  for (const course of courses) {
    const groupId = await upsertGoogleClassroomGroup({
      institutionId: input.institutionId,
      teacherId: input.teacherId,
      courseId: course.id,
      courseName: course.name,
      section: course.section,
    })

    const roster = await listGoogleClassroomCourseRoster(input.refreshToken, course.id, {
      teacherId: input.teacherId,
      institutionId: input.institutionId,
      courseId: course.id,
    })

    const emailByUserId = new Map<string, string>()

    for (const member of roster) {
      const email = member.email.trim().toLowerCase()
      emailByUserId.set(member.googleUserId, email)

      try {
        const existing = await findUserByEmail(email)

        if (!existing) {
          const studentId = await createActiveClassroomStudent({
            institutionId: input.institutionId,
            email,
            fullName: member.fullName,
            password: defaultPassword,
          })
          await upsertGroupStudent({
            institutionId: input.institutionId,
            groupId,
            studentId,
          })
          if (!processedEmails.has(email)) {
            summary.created += 1
            processedEmails.add(email)
          }
          summary.linked += 1
          continue
        }

        if (existing.institutionId !== input.institutionId) {
          summary.skipped += 1
          summary.errors.push({
            email,
            message: 'Email belongs to another institution',
          })
          continue
        }

        if (!existing.isStudent) {
          summary.skipped += 1
          summary.errors.push({
            email,
            message: 'User exists but is not a student',
          })
          continue
        }

        if (existing.accountStatus === 'pending' || !existing.isActive) {
          await activatePendingStudent(existing.id, defaultPassword)
          if (!processedEmails.has(email)) {
            summary.activated += 1
            processedEmails.add(email)
          }
        } else if (!processedEmails.has(email)) {
          processedEmails.add(email)
        }

        await upsertGroupStudent({
          institutionId: input.institutionId,
          groupId,
          studentId: existing.id,
        })
        summary.linked += 1
      } catch (error) {
        summary.skipped += 1
        summary.errors.push({
          email,
          message: error instanceof Error ? error.message : 'Failed to sync student',
        })
      }
    }

    await persistClassroomUserIdsFromRoster({
      institutionId: input.institutionId,
      emailByUserId,
    })
  }

  gcLogInfo(
    'Classroom student roster sync completed',
    { teacherId: input.teacherId, institutionId: input.institutionId },
    summary
  )

  return summary
}
