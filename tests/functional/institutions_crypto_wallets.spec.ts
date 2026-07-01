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

async function createSuperAdmin(client: any, email: string) {
  await User.create({
    email,
    password: 'Secret123!',
    fullName: 'Super Admin Crypto Wallets',
  })
  const user = await User.findByOrFail('email', email)
  await assignRoleToUser(user.id, 'super_admin', 'Super Admin')
  const loginResponse = await client.post('/api/v1/auth/login').json({
    email,
    password: 'Secret123!',
  })
  return (loginResponse.body() as any).data.token as string
}

async function createInstitution(
  codeSuffix: string,
  options: { cryptoWalletsEnabled?: boolean; status?: 'active' | 'inactive' | 'draft' } = {}
) {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `Crypto Wallet Institution ${codeSuffix}`,
      code: `CW-${codeSuffix}`,
      status: options.status ?? 'active',
      crypto_wallets_enabled: options.cryptoWalletsEnabled ?? false,
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

async function loginSchoolAdmin(client: any, email: string, institutionId: number) {
  await User.create({
    email,
    password: 'Secret123!',
    fullName: 'School Admin Crypto Wallets',
    institutionId,
    isActive: true,
  })
  const user = await User.findByOrFail('email', email)
  await assignRoleToUser(user.id, 'school_admin', 'School Admin')
  const loginResponse = await client.post('/api/v1/auth/login').json({
    email,
    password: 'Secret123!',
  })
  return (loginResponse.body() as any).data.token as string
}

test.group('Institutions crypto wallets toggle', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('super admin can enable and disable institution crypto wallets', async ({ client, assert }) => {
    const institutionId = await createInstitution(String(Date.now()))
    const token = await createSuperAdmin(client, `super-cw-${Date.now()}@example.com`)

    const enable = await client
      .patch(`/api/v1/institutions/${institutionId}/crypto-wallets`)
      .header('authorization', `Bearer ${token}`)
      .json({ enabled: true })
    enable.assertStatus(200)
    assert.equal((enable.body() as any).data.cryptoWalletsEnabled, true)

    const disable = await client
      .patch(`/api/v1/institutions/${institutionId}/crypto-wallets`)
      .header('authorization', `Bearer ${token}`)
      .json({ enabled: false })
    disable.assertStatus(200)
    assert.equal((disable.body() as any).data.cryptoWalletsEnabled, false)
  })

  test('non-super-admin cannot change institution crypto wallets', async ({ client }) => {
    const institutionId = await createInstitution(String(Date.now()))

    await User.create({
      email: 'teacher-cw@example.com',
      password: 'Secret123!',
      fullName: 'Teacher CW',
    })
    const teacher = await User.findByOrFail('email', 'teacher-cw@example.com')
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'teacher-cw@example.com',
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as any).data.token as string

    const response = await client
      .patch(`/api/v1/institutions/${institutionId}/crypto-wallets`)
      .header('authorization', `Bearer ${token}`)
      .json({ enabled: true })

    response.assertStatus(403)
    response.assertBodyContains({
      error: {
        code: 'FORBIDDEN_ROLE',
      },
    })
  })

  test('student provision skips wallet row when crypto wallets disabled', async ({ client, assert }) => {
    const institutionId = await createInstitution(String(Date.now()), { cryptoWalletsEnabled: false })
    const token = await loginSchoolAdmin(client, `school-admin-cw-off-${Date.now()}@example.com`, institutionId)

    const response = await client
      .post('/api/v1/institutions/users')
      .header('authorization', `Bearer ${token}`)
      .json({
        fullName: 'Student No Wallet',
        email: `student-no-wallet-${Date.now()}@example.com`,
        password: 'Secret123!',
        role: 'student',
      })

    response.assertStatus(200)
    const studentId = (response.body() as any).data.id as number
    const row = await db.from('token_balances').where('user_id', studentId).first()
    assert.isNull(row)
  })

  test('student provision creates wallet row when crypto wallets enabled', async ({ client, assert }) => {
    const institutionId = await createInstitution(String(Date.now()), { cryptoWalletsEnabled: true })
    const token = await loginSchoolAdmin(client, `school-admin-cw-on-${Date.now()}@example.com`, institutionId)

    const response = await client
      .post('/api/v1/institutions/users')
      .header('authorization', `Bearer ${token}`)
      .json({
        fullName: 'Student With Wallet',
        email: `student-with-wallet-${Date.now()}@example.com`,
        password: 'Secret123!',
        role: 'student',
      })

    response.assertStatus(200)
    const studentId = (response.body() as any).data.id as number
    const row = await db.from('token_balances').where('user_id', studentId).first()
    assert.isDefined(row)
    assert.equal(Number(row.balance), 0)
  })

  test('role assignment to student follows crypto wallets flag', async ({ client, assert }) => {
    const institutionId = await createInstitution(String(Date.now()), { cryptoWalletsEnabled: true })
    const token = await loginSchoolAdmin(client, `school-admin-role-cw-${Date.now()}@example.com`, institutionId)

    const teacher = await User.create({
      email: `teacher-to-student-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Teacher To Student',
      institutionId,
      isActive: true,
    })

    const roleResponse = await client
      .patch(`/api/v1/institutions/users/${teacher.id}/role`)
      .header('authorization', `Bearer ${token}`)
      .json({ role: 'student' })
    roleResponse.assertStatus(200)

    const row = await db.from('token_balances').where('user_id', teacher.id).first()
    assert.isDefined(row)
  })

  test('enabling crypto wallets backfills wallets for existing students', async ({ client, assert }) => {
    const institutionId = await createInstitution(String(Date.now()), { cryptoWalletsEnabled: false })

    const studentOne = await User.create({
      email: `backfill-student-1-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Backfill Student One',
      institutionId,
      isActive: true,
    })
    const studentTwo = await User.create({
      email: `backfill-student-2-${Date.now()}@example.com`,
      password: 'Secret123!',
      fullName: 'Backfill Student Two',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(studentOne.id, 'student', 'Student')
    await assignRoleToUser(studentTwo.id, 'student', 'Student')

    assert.isNull(await db.from('token_balances').where('user_id', studentOne.id).first())
    assert.isNull(await db.from('token_balances').where('user_id', studentTwo.id).first())

    const token = await createSuperAdmin(client, `super-backfill-${Date.now()}@example.com`)
    const enable = await client
      .patch(`/api/v1/institutions/${institutionId}/crypto-wallets`)
      .header('authorization', `Bearer ${token}`)
      .json({ enabled: true })

    enable.assertStatus(200)
    const body = enable.body() as any
    assert.equal(body.data.cryptoWalletsEnabled, true)
    assert.equal(body.data.walletsBackfilled, 2)

    assert.isDefined(await db.from('token_balances').where('user_id', studentOne.id).first())
    assert.isDefined(await db.from('token_balances').where('user_id', studentTwo.id).first())
  })
})
