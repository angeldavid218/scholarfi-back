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

test.group('Token health', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('school admin can read token health in mock mode', async ({ client, assert }) => {
    const inserted = await db
      .table('institutions')
      .insert({
        name: `Health Inst ${Date.now()}`,
        code: `HL-${Date.now()}`,
        status: 'active',
        created_by: null,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const row = inserted[0] as any
    const institutionId = typeof row === 'number' ? row : row.id

    const admin = await User.create({
      email: 'health-admin@example.com',
      password: 'Secret123!',
      fullName: 'Health Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'health-admin@example.com',
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as any).data.token as string

    const res = await client.get('/api/v1/token/health').header('authorization', `Bearer ${token}`)
    res.assertStatus(200)
    assert.equal((res.body() as any).data.tokenMode, 'mock')
    assert.equal((res.body() as any).data.healthy, true)
  })
})
