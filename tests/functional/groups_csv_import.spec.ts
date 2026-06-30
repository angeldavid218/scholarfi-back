import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

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
  const created = inserted[0] as { id: number } | number
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
      name: `Groups Institution ${codeSuffix}`,
      code: `GRP-${codeSuffix}`,
      status: 'active',
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as { id: number } | number
  return typeof created === 'number' ? created : created.id
}

test.group('School groups and CSV import', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('teacher imports CSV to create classes and enrollments', async ({ client, assert }) => {
    const institutionId = await createInstitution(String(Date.now()))

    const teacher = await User.create({
      email: `teacher-groups-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Groups Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const student = await User.create({
      email: `student-groups-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Groups Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: teacher.email,
      password: 'Secret123!',
    })
    loginResponse.assertStatus(200)
    const token = (loginResponse.body() as { data: { token: string } }).data.token

    const csv = [
      'student_email,student_name,subject,section',
      `${student.email},Groups Student,Matemáticas,3°A`,
    ].join('\n')

    const dryRunResponse = await client
      .post('/api/v1/groups/import-csv?dryRun=true')
      .header('Authorization', `Bearer ${token}`)
      .file('file', Buffer.from(csv), { filename: 'classes.csv', contentType: 'text/csv' })

    dryRunResponse.assertStatus(200)
    const dryRunBody = dryRunResponse.body() as any
    assert.isTrue(dryRunBody.data.dryRun)
    assert.equal(dryRunBody.data.summary.enrollmentsUpserted, 1)

    const importResponse = await client
      .post('/api/v1/groups/import-csv')
      .header('Authorization', `Bearer ${token}`)
      .file('file', Buffer.from(csv), { filename: 'classes.csv', contentType: 'text/csv' })

    importResponse.assertStatus(200)
    const importBody = importResponse.body() as any
    assert.isNumber(importBody.data.runId)
    assert.equal(importBody.data.summary.subjectsCreated, 1)
    assert.equal(importBody.data.summary.groupsCreated, 1)

    const mineResponse = await client
      .get('/api/v1/groups/mine')
      .header('Authorization', `Bearer ${token}`)

    mineResponse.assertStatus(200)
    const mineBody = mineResponse.body() as any
    assert.lengthOf(mineBody.data, 1)
    assert.equal(mineBody.data[0].subjectName, 'Matemáticas')
    assert.equal(mineBody.data[0].section, '3°A')
    assert.equal(mineBody.data[0].studentCount, 1)
  })

  test('school admin lists subjects and creates group with members', async ({ client, assert }) => {
    const institutionId = await createInstitution(`admin-${Date.now()}`)

    const schoolAdmin = await User.create({
      email: `admin-groups-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Groups Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(schoolAdmin.id, 'school_admin', 'School Admin')

    const teacher = await User.create({
      email: `admin-teacher-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Admin Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const student = await User.create({
      email: `admin-student-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Admin Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: schoolAdmin.email,
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as { data: { token: string } }).data.token

    const subjectResponse = await client
      .post('/api/v1/institutions/subjects')
      .header('Authorization', `Bearer ${token}`)
      .json({ name: 'Historia' })

    subjectResponse.assertStatus(200)
    const subjectId = (subjectResponse.body() as any).data.id

    const groupResponse = await client
      .post('/api/v1/institutions/groups')
      .header('Authorization', `Bearer ${token}`)
      .json({ subjectId, section: '2°B' })

    groupResponse.assertStatus(200)
    const groupId = (groupResponse.body() as any).data.id

    const teachersResponse = await client
      .post(`/api/v1/institutions/groups/${groupId}/teachers`)
      .header('Authorization', `Bearer ${token}`)
      .json({ userIds: [teacher.id] })
    teachersResponse.assertStatus(200)

    const studentsResponse = await client
      .post(`/api/v1/institutions/groups/${groupId}/students`)
      .header('Authorization', `Bearer ${token}`)
      .json({ userIds: [student.id] })
    studentsResponse.assertStatus(200)

    const listResponse = await client
      .get('/api/v1/institutions/groups')
      .header('Authorization', `Bearer ${token}`)

    listResponse.assertStatus(200)
    const listBody = listResponse.body() as any
    assert.lengthOf(listBody.data, 1)
    assert.equal(listBody.data[0].studentCount, 1)
  })
})
