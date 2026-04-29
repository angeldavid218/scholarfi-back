import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

async function ensureRole(roleKey: string, roleLabel: string) {
  const existingRole = await db.from('roles').where('key', roleKey).first()
  if (existingRole) {
    return existingRole.id as number
  }

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
  return typeof createdRole === 'number' ? createdRole : createdRole.id
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

test.group('Institutions create', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates institution with unique code in draft status for super admin', async ({
    client,
    assert,
  }) => {
    await User.create({
      email: 'super-admin@example.com',
      password: 'Secret123!',
      fullName: 'Super Admin',
    })

    const user = await User.findByOrFail('email', 'super-admin@example.com')
    await assignRoleToUser(user.id, 'super_admin', 'Super Admin')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'super-admin@example.com',
      password: 'Secret123!',
    })
    loginResponse.assertStatus(200)
    const loginBody = loginResponse.body() as any
    const token = loginBody.data.token as string

    const response = await client
      .post('/api/v1/institutions')
      .header('authorization', `Bearer ${token}`)
      .json({
        name: 'Alpha School',
        code: 'ALPHA',
      })

    response.assertStatus(200)
    const body = response.body() as any
    assert.equal(body.data.name, 'Alpha School')
    assert.equal(body.data.code, 'ALPHA')
    assert.equal(body.data.status, 'draft')
  })

  test('rejects duplicate institution code with standard error envelope', async ({ client }) => {
    await db.table('institutions').insert({
      name: 'Existing School',
      code: 'DUPLICATE',
      status: 'draft',
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })

    await User.create({
      email: 'dup-super-admin@example.com',
      password: 'Secret123!',
      fullName: 'Duplicate Super Admin',
    })
    const user = await User.findByOrFail('email', 'dup-super-admin@example.com')
    await assignRoleToUser(user.id, 'super_admin', 'Super Admin')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'dup-super-admin@example.com',
      password: 'Secret123!',
    })
    loginResponse.assertStatus(200)
    const loginBody = loginResponse.body() as any
    const token = loginBody.data.token as string

    const response = await client
      .post('/api/v1/institutions')
      .header('authorization', `Bearer ${token}`)
      .json({
        name: 'Another School',
        code: 'DUPLICATE',
      })

    response.assertStatus(409)
    response.assertBodyContains({
      error: {
        code: 'INSTITUTION_CODE_TAKEN',
        message: 'Institution code already exists',
        details: {
          field: 'code',
          value: 'DUPLICATE',
        },
      },
    })
  })
})
