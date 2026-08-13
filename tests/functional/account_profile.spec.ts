import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

async function assignRoleToUser(userId: number, roleKey: string, roleLabel: string) {
  const existingRole = await db.from('roles').where('key', roleKey).first()

  let roleId = existingRole?.id as number | undefined
  if (!roleId) {
    const inserted = await db
      .table('roles')
      .insert({
        key: roleKey,
        label: roleLabel,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const createdRole = inserted[0] as any
    roleId = typeof createdRole === 'number' ? createdRole : createdRole.id
  }

  await db.table('user_roles').insert({
    user_id: userId,
    role_id: roleId,
    created_at: new Date(),
    updated_at: null,
  })
}

test.group('Account profile', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('returns profile with roles and institution scope in data envelope', async ({
    client,
    assert,
  }) => {
    const institutionInsert = await db
      .table('institutions')
      .insert({
        name: 'Demo Institution',
        code: 'DEMO-1',
        status: 'active',
        created_by: null,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const createdInstitution = institutionInsert[0] as any
    const institutionId =
      typeof createdInstitution === 'number' ? createdInstitution : createdInstitution.id

    const user = await User.create({
      email: 'profile-user@example.com',
      password: 'Secret123!',
      fullName: 'Profile User',
      institutionId,
    })
    await assignRoleToUser(user.id, 'teacher', 'Teacher')
    await assignRoleToUser(user.id, 'school_admin', 'School Admin')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'profile-user@example.com',
      password: 'Secret123!',
    })
    loginResponse.assertStatus(200)
    const loginBody = loginResponse.body() as any
    const token = loginBody.data.token as string

    const response = await client
      .get('/api/v1/account/profile')
      .header('authorization', `Bearer ${token}`)

    response.assertStatus(200)
    const body = response.body() as any
    const payload = body.data?.data ?? body.data ?? body

    assert.equal(payload.email, 'profile-user@example.com')
    assert.equal(payload.institutionId, institutionId)
    assert.equal(payload.institutionName, 'Demo Institution')
    assert.deepEqual(payload.roles.sort(), ['school_admin', 'teacher'])
  })

  test('authenticated user can change password with current password', async ({ client, assert }) => {
    const user = await User.create({
      email: 'change-password-user@example.com',
      password: 'Secret123!',
      fullName: 'Change Password User',
      isActive: true,
      accountStatus: 'active',
    })
    await assignRoleToUser(user.id, 'student', 'Student')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'change-password-user@example.com',
      password: 'Secret123!',
    })
    loginResponse.assertStatus(200)
    const token = (loginResponse.body() as any).data.token as string

    const badCurrent = await client
      .patch('/api/v1/account/password')
      .header('authorization', `Bearer ${token}`)
      .json({
        currentPassword: 'WrongPass1!',
        password: 'NewSecret99!',
        passwordConfirmation: 'NewSecret99!',
      })
    badCurrent.assertStatus(400)
    assert.equal((badCurrent.body() as any).error.code, 'CURRENT_PASSWORD_INVALID')

    const ok = await client
      .patch('/api/v1/account/password')
      .header('authorization', `Bearer ${token}`)
      .json({
        currentPassword: 'Secret123!',
        password: 'NewSecret99!',
        passwordConfirmation: 'NewSecret99!',
      })
    ok.assertStatus(200)
    assert.equal((ok.body() as any).data.updated, true)

    const oldLogin = await client.post('/api/v1/auth/login').json({
      email: 'change-password-user@example.com',
      password: 'Secret123!',
    })
    oldLogin.assertStatus(401)

    const newLogin = await client.post('/api/v1/auth/login').json({
      email: 'change-password-user@example.com',
      password: 'NewSecret99!',
    })
    newLogin.assertStatus(200)
  })
})
