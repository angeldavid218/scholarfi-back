import db from '@adonisjs/lucid/services/db'
import {
  findInstitutionGroup,
  findOrCreateSubject,
  upsertGroupStudent,
  upsertGroupTeacher,
} from '#services/group_upsert_service'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

function classroomGroupSyncMetadata() {
  return JSON.stringify({ source: 'google_classroom' })
}

export async function upsertGoogleClassroomGroup(input: {
  institutionId: number
  teacherId: number
  courseId: string
  courseName: string
  section?: string | null
}) {
  const section = input.section?.trim() || null
  const subjectName = input.courseName.trim()

  return db.transaction(async (trx) => {
    const existing = await trx
      .from('groups')
      .where('institution_id', input.institutionId)
      .andWhere('external_source', 'google_classroom')
      .andWhere('external_id', input.courseId)
      .first()

    if (existing) {
      await trx
        .from('groups')
        .where('id', existing.id)
        .update({
          name: subjectName,
          section,
          updated_at: new Date(),
        })

      await upsertGroupTeacher(
        {
          institutionId: input.institutionId,
          groupId: existing.id as number,
          teacherId: input.teacherId,
        },
        trx
      )

      return existing.id as number
    }

    const subject = await findOrCreateSubject(input.institutionId, subjectName, trx)
    const existingBySubjectSection = await findInstitutionGroup(
      {
        institutionId: input.institutionId,
        subjectId: subject.id as number,
        subjectName,
        section,
        className: subjectName,
      },
      trx
    )

    if (existingBySubjectSection) {
      await trx
        .from('groups')
        .where('id', existingBySubjectSection.id)
        .update({
          name: subjectName,
          section,
          external_source: 'google_classroom',
          external_id: input.courseId,
          sync_metadata: classroomGroupSyncMetadata(),
          updated_at: new Date(),
        })

      await upsertGroupTeacher(
        {
          institutionId: input.institutionId,
          groupId: existingBySubjectSection.id as number,
          teacherId: input.teacherId,
        },
        trx
      )

      return existingBySubjectSection.id as number
    }

    const groupId = await insertGoogleClassroomGroup(
      {
        institutionId: input.institutionId,
        subjectId: subject.id as number,
        courseId: input.courseId,
        courseName: subjectName,
        section,
        teacherId: input.teacherId,
      },
      trx
    )

    await upsertGroupTeacher(
      {
        institutionId: input.institutionId,
        groupId,
        teacherId: input.teacherId,
      },
      trx
    )

    return groupId
  })
}

async function insertGoogleClassroomGroup(
  input: {
    institutionId: number
    subjectId: number
    courseId: string
    courseName: string
    section: string | null
    teacherId: number
  },
  trx: TransactionClientContract
): Promise<number> {
  const inserted = await trx
    .table('groups')
    .insert({
      institution_id: input.institutionId,
      subject_id: input.subjectId,
      name: input.courseName,
      section: input.section,
      code: null,
      sync_metadata: classroomGroupSyncMetadata(),
      status: 'active',
      external_source: 'google_classroom',
      external_id: input.courseId,
      created_by_teacher_id: input.teacherId,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')

  const row = inserted[0] as { id: number } | number
  return typeof row === 'number' ? row : row.id
}

export async function linkGroupStudentsByEmail(
  institutionId: number,
  groupId: number,
  emails: string[]
): Promise<number> {
  let linked = 0

  for (const rawEmail of emails) {
    const email = rawEmail.trim().toLowerCase()
    const student = await db
      .from('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .where('users.institution_id', institutionId)
      .andWhere('roles.key', 'student')
      .whereRaw('LOWER(users.email) = ?', [email])
      .select('users.id as id')
      .first()

    if (!student) continue

    await upsertGroupStudent({
      institutionId,
      groupId,
      studentId: student.id as number,
    })
    linked += 1
  }

  return linked
}
