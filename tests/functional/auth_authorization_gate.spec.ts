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

test.group('Authorization gate', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('denies unauthenticated request with standardized auth error', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/v1/account/profile')

    response.assertStatus(401)
    response.assertBodyContains({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
      },
    })

    const body = response.body() as any
    assert.isString(body.error.requestId)
    assert.isAbove(body.error.requestId.length, 0)
  })

  test('denies authenticated request without required role', async ({ client, assert }) => {
    await User.create({
      email: 'no-role@example.com',
      password: 'Secret123!',
      fullName: 'No Role',
    })

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'no-role@example.com',
      password: 'Secret123!',
    })
    loginResponse.assertStatus(200)
    const loginBody = loginResponse.body() as any
    const token = loginBody.data.token as string

    const response = await client
      .get('/api/v1/account/profile')
      .header('authorization', `Bearer ${token}`)

    response.assertStatus(403)
    response.assertBodyContains({
      error: {
        code: 'FORBIDDEN_ROLE',
        message: 'Insufficient role permissions',
      },
    })

    const body = response.body() as any
    assert.isString(body.error.requestId)
    assert.isAbove(body.error.requestId.length, 0)
  })

  test('allows authenticated request with required role', async ({ client, assert }) => {
    const user = await User.create({
      email: 'teacher-role@example.com',
      password: 'Secret123!',
      fullName: 'Teacher Role',
    })
    await assignRoleToUser(user.id, 'teacher', 'Teacher')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'teacher-role@example.com',
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
    assert.equal(payload.email, 'teacher-role@example.com')
  })
})
