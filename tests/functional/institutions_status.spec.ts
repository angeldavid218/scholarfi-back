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

test.group('Institutions status', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('super admin can activate and deactivate institution', async ({ client, assert }) => {
    const inserted = await db
      .table('institutions')
      .insert({
        name: 'Toggle School',
        code: 'TOGGLE',
        status: 'draft',
        created_by: null,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const created = inserted[0] as any
    const institutionId = typeof created === 'number' ? created : created.id

    await User.create({
      email: 'status-super-admin@example.com',
      password: 'Secret123!',
      fullName: 'Status Super Admin',
    })
    const superAdmin = await User.findByOrFail('email', 'status-super-admin@example.com')
    await assignRoleToUser(superAdmin.id, 'super_admin', 'Super Admin')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'status-super-admin@example.com',
      password: 'Secret123!',
    })
    const loginBody = loginResponse.body() as any
    const token = loginBody.data.token as string

    const activate = await client
      .patch(`/api/v1/institutions/${institutionId}/status`)
      .header('authorization', `Bearer ${token}`)
      .json({ status: 'active' })
    activate.assertStatus(200)
    assert.equal((activate.body() as any).data.status, 'active')

    const deactivate = await client
      .patch(`/api/v1/institutions/${institutionId}/status`)
      .header('authorization', `Bearer ${token}`)
      .json({ status: 'inactive' })
    deactivate.assertStatus(200)
    assert.equal((deactivate.body() as any).data.status, 'inactive')
  })

  test('non-super-admin cannot change institution status', async ({ client }) => {
    const inserted = await db
      .table('institutions')
      .insert({
        name: 'Role Block School',
        code: 'ROLEBLOCK',
        status: 'draft',
        created_by: null,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const created = inserted[0] as any
    const institutionId = typeof created === 'number' ? created : created.id

    await User.create({
      email: 'teacher-status@example.com',
      password: 'Secret123!',
      fullName: 'Teacher Status',
    })
    const teacher = await User.findByOrFail('email', 'teacher-status@example.com')
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'teacher-status@example.com',
      password: 'Secret123!',
    })
    const loginBody = loginResponse.body() as any
    const token = loginBody.data.token as string

    const response = await client
      .patch(`/api/v1/institutions/${institutionId}/status`)
      .header('authorization', `Bearer ${token}`)
      .json({ status: 'active' })

    response.assertStatus(403)
    response.assertBodyContains({
      error: {
        code: 'FORBIDDEN_ROLE',
      },
    })
  })
})
