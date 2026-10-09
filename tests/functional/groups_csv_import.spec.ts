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

async function createInstitution(
  codeSuffix: string,
  options: { cryptoWalletsEnabled?: boolean } = {}
) {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `Groups Institution ${codeSuffix}`,
      code: `GRP-${codeSuffix}`,
      status: 'active',
      crypto_wallets_enabled: options.cryptoWalletsEnabled ?? false,
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
      'student_email,student_name,registration_number,subject,section',
      `${student.email},Groups Student,MAT-GRP-001,Matemáticas,3°A`,
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

  test('teacher imports CSV and provisions new students without wallet when crypto disabled', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution(String(Date.now()), {
      cryptoWalletsEnabled: false,
    })

    const teacher = await User.create({
      email: `teacher-provision-off-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Provision Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: teacher.email,
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as { data: { token: string } }).data.token

    const newStudentEmail = `new-student-off-${Date.now()}@example.com`
    const csv = [
      'student_email,student_name,registration_number,subject,section',
      `${newStudentEmail},Nuevo Estudiante,MAT-OFF-001,Matemáticas,3°A`,
    ].join('\n')

    const importResponse = await client
      .post('/api/v1/groups/import-csv')
      .header('Authorization', `Bearer ${token}`)
      .file('file', Buffer.from(csv), { filename: 'classes.csv', contentType: 'text/csv' })

    importResponse.assertStatus(200)
    const importBody = importResponse.body() as any
    assert.equal(importBody.data.summary.studentsCreated, 1)

    const student = await db
      .from('users')
      .where('institution_id', institutionId)
      .where('email', newStudentEmail)
      .select('id', 'account_status', 'is_active', 'registration_number')
      .first()

    assert.isDefined(student)
    assert.equal(student.account_status, 'pending')
    assert.equal(student.is_active, 0)
    assert.equal(student.registration_number, 'MAT-OFF-001')
    const wallet = await db.from('token_balances').where('user_id', student.id).first()
    assert.isNull(wallet)
  })

  test('teacher imports CSV and creates wallet when crypto enabled', async ({ client, assert }) => {
    const institutionId = await createInstitution(String(Date.now()), {
      cryptoWalletsEnabled: true,
    })

    const teacher = await User.create({
      email: `teacher-provision-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Provision Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: teacher.email,
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as { data: { token: string } }).data.token

    const newStudentEmail = `new-student-${Date.now()}@example.com`
    const csv = [
      'student_email,student_name,registration_number,subject,section',
      `${newStudentEmail},Nuevo Estudiante,MAT-ON-001,Matemáticas,3°A`,
    ].join('\n')

    const importResponse = await client
      .post('/api/v1/groups/import-csv')
      .header('Authorization', `Bearer ${token}`)
      .file('file', Buffer.from(csv), { filename: 'classes.csv', contentType: 'text/csv' })

    importResponse.assertStatus(200)
    const importBody = importResponse.body() as any
    assert.equal(importBody.data.summary.studentsCreated, 1)
    assert.equal(importBody.data.summary.enrollmentsUpserted, 1)
    assert.lengthOf(importBody.data.summary.errors, 0)

    const student = await db
      .from('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .where('users.institution_id', institutionId)
      .where('roles.key', 'student')
      .where('users.email', newStudentEmail)
      .select('users.id as id', 'users.full_name as fullName')
      .first()

    assert.isDefined(student)
    assert.equal(student.fullName, 'Nuevo Estudiante')

    const wallet = await db.from('token_balances').where('user_id', student.id).first()
    assert.isDefined(wallet)
  })

  test('teacher imports CSV with custom column mapping', async ({ client, assert }) => {
    const institutionId = await createInstitution(String(Date.now()))

    const teacher = await User.create({
      email: `teacher-mapping-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Mapping Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const student = await User.create({
      email: `student-mapping-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Mapping Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: teacher.email,
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as { data: { token: string } }).data.token

    const csv = [
      'ID interno,Correo electrónico,Apellidos y nombres,Matrícula,Asignatura,Grupo,Notas,Teléfono tutor',
      `001,${student.email},Mapping Student,MAT-MAP-001,Matemáticas,3°A,10,555-0100`,
    ].join('\n')

    const columnMapping = JSON.stringify({
      student_email: 'Correo electrónico',
      student_name: 'Apellidos y nombres',
      registration_number: 'Matrícula',
      subject: 'Asignatura',
      section: 'Grupo',
    })

    const importResponse = await client
      .post('/api/v1/groups/import-csv')
      .header('Authorization', `Bearer ${token}`)
      .file('file', Buffer.from(csv), { filename: 'classes.csv', contentType: 'text/csv' })
      .fields({ columnMapping })

    importResponse.assertStatus(200)
    const importBody = importResponse.body() as any
    assert.equal(importBody.data.summary.enrollmentsUpserted, 1)
    assert.equal(importBody.data.summary.groupsCreated, 1)
    assert.lengthOf(importBody.data.summary.errors, 0)

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

  test('teacher CSV import enrolls students into existing Google Classroom group', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution(`gc-merge-${Date.now()}`)

    const teacher = await User.create({
      email: `teacher-gc-merge-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'GC Merge Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const student = await User.create({
      email: `student-gc-merge-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'GC Merge Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const subjectInserted = await db
      .table('subjects')
      .insert({
        institution_id: institutionId,
        name: 'Matematicas 3A',
        code: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const subjectId =
      typeof subjectInserted[0] === 'number' ? subjectInserted[0] : subjectInserted[0].id

    const groupInserted = await db
      .table('groups')
      .insert({
        institution_id: institutionId,
        subject_id: subjectId,
        name: 'Matematicas 3A',
        section: '3A',
        code: null,
        sync_metadata: { source: 'google_classroom' },
        status: 'active',
        external_source: 'google_classroom',
        external_id: 'gc-course-1',
        created_by_teacher_id: teacher.id,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const classroomGroupId =
      typeof groupInserted[0] === 'number' ? groupInserted[0] : groupInserted[0].id

    await db.table('group_teachers').insert({
      institution_id: institutionId,
      group_id: classroomGroupId,
      teacher_id: teacher.id,
      created_at: new Date(),
      updated_at: null,
    })

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: teacher.email,
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as { data: { token: string } }).data.token

    const csv = [
      'student_email,student_name,registration_number,subject,section,class_name',
      `${student.email},GC Merge Student,MAT-GC-001,Matematicas 3A,3A,Matematicas 3A`,
    ].join('\n')

    const importResponse = await client
      .post('/api/v1/groups/import-csv')
      .header('Authorization', `Bearer ${token}`)
      .file('file', Buffer.from(csv), { filename: 'classes.csv', contentType: 'text/csv' })

    importResponse.assertStatus(200)
    const importBody = importResponse.body() as any
    assert.equal(importBody.data.summary.groupsCreated, 0)
    assert.equal(importBody.data.summary.enrollmentsUpserted, 1)

    const groups = await db
      .from('groups')
      .where('institution_id', institutionId)
      .where('section', '3A')
      .whereILike('name', 'Matematicas 3A')

    assert.lengthOf(groups, 1)
    assert.equal(groups[0].id, classroomGroupId)
    assert.equal(groups[0].external_source, 'google_classroom')

    const enrollment = await db
      .from('group_students')
      .where('group_id', classroomGroupId)
      .where('student_id', student.id)
      .first()

    assert.isDefined(enrollment)
  })
})
