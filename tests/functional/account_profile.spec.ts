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
    assert.deepEqual(payload.roles.sort(), ['school_admin', 'teacher'])
  })
})
