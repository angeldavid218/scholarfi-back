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

async function createInstitution(name: string, code: string) {
  const inserted = await db
    .table('institutions')
    .insert({
      name,
      code,
      status: 'active',
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

test.group('Tenant scope enforcement', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('denies school-role user requesting a different institution scope', async ({
    client,
    assert,
  }) => {
    const institutionA = await createInstitution('Institution A', 'INST-A')
    const institutionB = await createInstitution('Institution B', 'INST-B')

    const user = await User.create({
      email: 'tenant-teacher@example.com',
      password: 'Secret123!',
      fullName: 'Tenant Teacher',
      institutionId: institutionA,
    })
    await assignRoleToUser(user.id, 'teacher', 'Teacher')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'tenant-teacher@example.com',
      password: 'Secret123!',
    })
    loginResponse.assertStatus(200)
    const loginBody = loginResponse.body() as any
    const token = loginBody.data.token as string

    const response = await client
      .get('/api/v1/account/profile')
      .header('authorization', `Bearer ${token}`)
      .qs({ institution_id: institutionB })

    response.assertStatus(403)
    response.assertBodyContains({
      error: {
        code: 'TENANT_SCOPE_VIOLATION',
        message: 'Cross-tenant access is not allowed',
      },
    })

    const body = response.body() as any
    assert.isString(body.error.requestId)
    assert.isAbove(body.error.requestId.length, 0)
  })

  test('allows school-role user requesting their own institution scope', async ({
    client,
    assert,
  }) => {
    const institutionA = await createInstitution('Institution C', 'INST-C')

    const user = await User.create({
      email: 'tenant-student@example.com',
      password: 'Secret123!',
      fullName: 'Tenant Student',
      institutionId: institutionA,
    })
    await assignRoleToUser(user.id, 'student', 'Student')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'tenant-student@example.com',
      password: 'Secret123!',
    })
    loginResponse.assertStatus(200)
    const loginBody = loginResponse.body() as any
    const token = loginBody.data.token as string

    const response = await client
      .get('/api/v1/account/profile')
      .header('authorization', `Bearer ${token}`)
      .qs({ institution_id: institutionA })

    response.assertStatus(200)
    const body = response.body() as any
    const payload = body.data?.data ?? body.data ?? body
    assert.equal(payload.email, 'tenant-student@example.com')
    assert.equal(payload.institutionId, institutionA)
  })
})
