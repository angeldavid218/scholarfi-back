import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import StudentGradeProgress from '#models/student_grade_progress'
import {
  listInstitutionGradeProgress,
  listTeacherStudentIds,
} from '#services/analytics/grade_progress_service'
import env from '#start/env'

function returningId(inserted: unknown[]): number {
  const row = inserted[0] as any
  return typeof row === 'number' ? row : row.id
}

async function createInstitution(): Promise<number> {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `Progress Inst ${Date.now()}`,
      code: `PRG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'active',
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return returningId(inserted)
}

async function createUser(institutionId: number, emailPrefix: string): Promise<number> {
  const inserted = await db
    .table('users')
    .insert({
      email: `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
      password: 'hashed',
      full_name: emailPrefix,
      institution_id: institutionId,
      is_active: true,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return returningId(inserted)
}

async function createSubject(institutionId: number): Promise<number> {
  const inserted = await db
    .table('subjects')
    .insert({
      institution_id: institutionId,
      name: 'Math',
      status: 'active',
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return returningId(inserted)
}

async function createGroup(
  institutionId: number,
  subjectId: number,
  teacherId: number
): Promise<number> {
  const inserted = await db
    .table('groups')
    .insert({
      institution_id: institutionId,
      subject_id: subjectId,
      name: `Group ${Date.now()}`,
      status: 'active',
      external_source: 'manual',
      created_by_teacher_id: teacherId,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return returningId(inserted)
}

test.group('grade progress teacher scope', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('listTeacherStudentIds returns only students in teacher groups', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') return

    const institutionId = await createInstitution()
    const subjectId = await createSubject(institutionId)
    const teacherId = await createUser(institutionId, 'teacher')
    const otherTeacherId = await createUser(institutionId, 'other-teacher')
    const studentA = await createUser(institutionId, 'student-a')
    const studentB = await createUser(institutionId, 'student-b')
    const studentC = await createUser(institutionId, 'student-c')

    const groupMine = await createGroup(institutionId, subjectId, teacherId)
    const groupOther = await createGroup(institutionId, subjectId, otherTeacherId)

    await db.table('group_teachers').insert([
      {
        institution_id: institutionId,
        group_id: groupMine,
        teacher_id: teacherId,
        created_at: new Date(),
        updated_at: null,
      },
      {
        institution_id: institutionId,
        group_id: groupOther,
        teacher_id: otherTeacherId,
        created_at: new Date(),
        updated_at: null,
      },
    ])

    await db.table('group_students').insert([
      {
        institution_id: institutionId,
        group_id: groupMine,
        student_id: studentA,
        created_at: new Date(),
        updated_at: null,
      },
      {
        institution_id: institutionId,
        group_id: groupMine,
        student_id: studentB,
        created_at: new Date(),
        updated_at: null,
      },
      {
        institution_id: institutionId,
        group_id: groupOther,
        student_id: studentC,
        created_at: new Date(),
        updated_at: null,
      },
    ])

    const ids = await listTeacherStudentIds(institutionId, teacherId)
    assert.sameMembers(ids, [studentA, studentB])
  })

  test('listInstitutionGradeProgress filters by studentIds', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') return

    const institutionId = await createInstitution()
    const studentA = await createUser(institutionId, 'filter-a')
    const studentB = await createUser(institutionId, 'filter-b')

    await StudentGradeProgress.createMany([
      {
        institutionId,
        studentId: studentA,
        category: 'improving',
        gradedCount: 4,
        earlyAvg: '40.0000',
        lateAvg: '70.0000',
        delta: '30.0000',
        analyzedAt: DateTime.now(),
      },
      {
        institutionId,
        studentId: studentB,
        category: 'maintaining',
        gradedCount: 4,
        earlyAvg: '70.0000',
        lateAvg: '72.0000',
        delta: '2.0000',
        analyzedAt: DateTime.now(),
      },
    ])

    const all = await listInstitutionGradeProgress(institutionId)
    assert.lengthOf(all, 2)

    const filtered = await listInstitutionGradeProgress(institutionId, {
      studentIds: [studentA],
    })
    assert.lengthOf(filtered, 1)
    assert.equal(filtered[0].studentId, studentA)
    assert.equal(filtered[0].category, 'improving')

    const empty = await listInstitutionGradeProgress(institutionId, { studentIds: [] })
    assert.lengthOf(empty, 0)
  })
})
