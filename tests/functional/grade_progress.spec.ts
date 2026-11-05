import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import StudentGradeProgress from '#models/student_grade_progress'

async function ensureRole(roleKey: string, roleLabel: string) {
  const existingRole = await db.from('roles').where('key', roleKey).first()
  if (existingRole) return existingRole.id as number

  const inserted = await db
    .table('roles')
    .insert({
      key: roleKey,
      label: roleLabel,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

async function assignRoleToUser(userId: number, roleKey: string, roleLabel: string) {
  const roleId = await ensureRole(roleKey, roleLabel)
  await db.table('user_roles').insert({
    user_id: userId,
    role_id: roleId,
    created_at: new Date(),
    updated_at: null,
  })
}

async function createInstitution(codeSuffix: string) {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `Grade Progress ${codeSuffix}`,
      code: `GP-${codeSuffix}`,
      status: 'active',
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

test.group('GET /grade-progress', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('teacher only sees students in their groups; admin sees all with summary', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution(`${Date.now()}`)

    const teacher = await User.create({
      email: `gp-teacher-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'GP Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const admin = await User.create({
      email: `gp-admin-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'GP Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const studentMine = await User.create({
      email: `gp-mine-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Mine Student',
      institutionId,
      isActive: true,
    })
    const studentOther = await User.create({
      email: `gp-other-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Other Student',
      institutionId,
      isActive: true,
    })

    const subjectInserted = await db
      .table('subjects')
      .insert({
        institution_id: institutionId,
        name: 'Science',
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const subjectRow = subjectInserted[0] as any
    const subjectId = typeof subjectRow === 'number' ? subjectRow : subjectRow.id

    const groupInserted = await db
      .table('groups')
      .insert({
        institution_id: institutionId,
        subject_id: subjectId,
        name: 'Teacher Group',
        status: 'active',
        external_source: 'manual',
        created_by_teacher_id: teacher.id,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const groupRow = groupInserted[0] as any
    const groupId = typeof groupRow === 'number' ? groupRow : groupRow.id

    await db.table('group_teachers').insert({
      institution_id: institutionId,
      group_id: groupId,
      teacher_id: teacher.id,
      created_at: new Date(),
      updated_at: null,
    })
    await db.table('group_students').insert({
      institution_id: institutionId,
      group_id: groupId,
      student_id: studentMine.id,
      created_at: new Date(),
      updated_at: null,
    })

    await StudentGradeProgress.createMany([
      {
        institutionId,
        studentId: studentMine.id,
        category: 'improving',
        gradedCount: 4,
        earlyAvg: '40.0000',
        lateAvg: '70.0000',
        delta: '30.0000',
        analyzedAt: DateTime.now(),
      },
      {
        institutionId,
        studentId: studentOther.id,
        category: 'maintaining',
        gradedCount: 4,
        earlyAvg: '70.0000',
        lateAvg: '72.0000',
        delta: '2.0000',
        analyzedAt: DateTime.now(),
      },
    ])

    const teacherLogin = await client.post('/api/v1/auth/login').json({
      email: teacher.email,
      password: 'Secret123!',
    })
    const teacherToken = (teacherLogin.body() as any).data.token as string

    const teacherRes = await client
      .get('/api/v1/grade-progress')
      .header('authorization', `Bearer ${teacherToken}`)
    teacherRes.assertStatus(200)
    const teacherBody = teacherRes.body() as any
    assert.equal(teacherBody.summary.total, 1)
    assert.equal(teacherBody.summary.improving, 1)
    assert.lengthOf(teacherBody.students, 1)
    assert.equal(teacherBody.students[0].studentId, studentMine.id)

    const adminLogin = await client.post('/api/v1/auth/login').json({
      email: admin.email,
      password: 'Secret123!',
    })
    const adminToken = (adminLogin.body() as any).data.token as string

    const adminRes = await client
      .get('/api/v1/grade-progress')
      .header('authorization', `Bearer ${adminToken}`)
    adminRes.assertStatus(200)
    const adminBody = adminRes.body() as any
    assert.equal(adminBody.summary.total, 2)
    assert.equal(adminBody.summary.improving, 1)
    assert.equal(adminBody.summary.maintaining, 1)
    assert.lengthOf(adminBody.students, 2)
  })
})
