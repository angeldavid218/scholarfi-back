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
      name: `Registration Institution ${codeSuffix}`,
      code: `REG-${codeSuffix}`,
      status: 'active',
      crypto_wallets_enabled: false,
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as { id: number } | number
  return typeof created === 'number' ? created : created.id
}

test.group('Student registration via matrícula', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('CSV import creates pending student and claim activates account', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution(String(Date.now()))

    const teacher = await User.create({
      email: `teacher-reg-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Registration Teacher',
      institutionId,
      isActive: true,
      accountStatus: 'active',
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: teacher.email,
      password: 'Secret123!',
    })
    loginResponse.assertStatus(200)
    const token = (loginResponse.body() as { data: { token: string } }).data.token

    const studentEmail = `pending-student-${Date.now()}@example.com`
    const registrationNumber = 'MAT-REG-100'
    const csv = [
      'student_email,student_name,registration_number,subject,section',
      `${studentEmail},Pending Student,${registrationNumber},Matemáticas,3°A`,
    ].join('\n')

    const importResponse = await client
      .post('/api/v1/groups/import-csv')
      .header('Authorization', `Bearer ${token}`)
      .file('file', Buffer.from(csv), { filename: 'classes.csv', contentType: 'text/csv' })

    importResponse.assertStatus(200)
    const importBody = importResponse.body() as any
    assert.equal(importBody.data.summary.studentsCreated, 1)

    const pendingUser = await db
      .from('users')
      .where('email', studentEmail)
      .select('id', 'account_status', 'is_active', 'registration_number')
      .first()

    assert.isDefined(pendingUser)
    assert.equal(pendingUser.account_status, 'pending')
    assert.equal(pendingUser.is_active, 0)
    assert.equal(pendingUser.registration_number, registrationNumber)

    const claimResponse = await client.post('/api/v1/auth/register-student').json({
      email: studentEmail,
      registrationNumber,
      password: 'StudentPass1!',
      passwordConfirmation: 'StudentPass1!',
    })

    claimResponse.assertStatus(200)
    const claimBody = claimResponse.body() as any
    assert.isString(claimBody.data.token)

    const activated = await db
      .from('users')
      .where('email', studentEmail)
      .select('account_status', 'is_active')
      .first()

    assert.equal(activated.account_status, 'active')
    assert.equal(activated.is_active, 1)

    const studentLogin = await client.post('/api/v1/auth/login').json({
      email: studentEmail,
      password: 'StudentPass1!',
    })
    studentLogin.assertStatus(200)
  })

  test('claim rejects wrong matrícula', async ({ client, assert }) => {
    const institutionId = await createInstitution(`wrong-${Date.now()}`)

    const student = await User.create({
      email: `wrong-matricula-${Date.now()}@example.com`,
      password: 'RandomPass1!',
      fullName: 'Wrong Matricula',
      institutionId,
      isActive: false,
      accountStatus: 'pending',
      registrationNumber: 'MAT-CORRECT',
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const claimResponse = await client.post('/api/v1/auth/register-student').json({
      email: student.email,
      registrationNumber: 'MAT-WRONG',
      password: 'StudentPass1!',
      passwordConfirmation: 'StudentPass1!',
    })

    claimResponse.assertStatus(400)
    const body = claimResponse.body() as any
    assert.equal(body.error.code, 'STUDENT_REGISTRATION_INVALID')
  })

  test('claim rejects already active student', async ({ client, assert }) => {
    const institutionId = await createInstitution(`active-${Date.now()}`)

    const student = await User.create({
      email: `active-student-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Active Student',
      institutionId,
      isActive: true,
      accountStatus: 'active',
      registrationNumber: 'MAT-ACTIVE',
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const claimResponse = await client.post('/api/v1/auth/register-student').json({
      email: student.email,
      registrationNumber: 'MAT-ACTIVE',
      password: 'StudentPass1!',
      passwordConfirmation: 'StudentPass1!',
    })

    claimResponse.assertStatus(400)
    const body = claimResponse.body() as any
    assert.equal(body.error.code, 'STUDENT_REGISTRATION_INVALID')
  })

  test('login blocked for pending account with known password', async ({ client, assert }) => {
    const institutionId = await createInstitution(`pending-login-${Date.now()}`)

    const student = await User.create({
      email: `pending-login-${Date.now()}@example.com`,
      password: 'PendingPass1!',
      fullName: 'Pending Login',
      institutionId,
      isActive: false,
      accountStatus: 'pending',
      registrationNumber: 'MAT-PENDING',
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: student.email,
      password: 'PendingPass1!',
    })

    loginResponse.assertStatus(401)
    const body = loginResponse.body() as any
    assert.equal(body.error.code, 'ACCOUNT_PENDING_REGISTRATION')
  })

  test('CSV import rejects duplicate matrícula in same institution', async ({ client, assert }) => {
    const institutionId = await createInstitution(`dup-${Date.now()}`)

    const teacher = await User.create({
      email: `teacher-dup-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Dup Teacher',
      institutionId,
      isActive: true,
      accountStatus: 'active',
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    await User.create({
      email: `existing-dup-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Existing Student',
      institutionId,
      isActive: true,
      accountStatus: 'active',
      registrationNumber: 'MAT-DUP',
    }).then(async (user) => {
      await assignRoleToUser(user.id, 'student', 'Student')
    })

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: teacher.email,
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as { data: { token: string } }).data.token

    const csv = [
      'student_email,student_name,registration_number,subject,section',
      `new-dup-${Date.now()}@example.com,New Dup,MAT-DUP,Matemáticas,3°A`,
    ].join('\n')

    const importResponse = await client
      .post('/api/v1/groups/import-csv')
      .header('Authorization', `Bearer ${token}`)
      .file('file', Buffer.from(csv), { filename: 'classes.csv', contentType: 'text/csv' })

    importResponse.assertStatus(200)
    const importBody = importResponse.body() as any
    assert.equal(importBody.data.summary.studentsCreated, 0)
    assert.isAtLeast(importBody.data.summary.errors.length, 1)
    assert.match(importBody.data.summary.errors[0].message, /Registration number already used/i)
  })
})
