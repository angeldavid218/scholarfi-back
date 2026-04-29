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

async function createInstitution() {
  const inserted = await db
    .table('institutions')
    .insert({
      name: 'Bootstrap Institution',
      code: `BOOT-${Date.now()}`,
      status: 'draft',
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

test.group('Institutions bootstrap school admin', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('super admin can create first school admin for institution', async ({ client, assert }) => {
    const institutionId = await createInstitution()

    await User.create({
      email: 'bootstrap-super-admin@example.com',
      password: 'Secret123!',
      fullName: 'Bootstrap Super Admin',
    })
    const superAdmin = await User.findByOrFail('email', 'bootstrap-super-admin@example.com')
    await assignRoleToUser(superAdmin.id, 'super_admin', 'Super Admin')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'bootstrap-super-admin@example.com',
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as any).data.token as string

    const response = await client
      .post(`/api/v1/institutions/${institutionId}/bootstrap-school-admin`)
      .header('authorization', `Bearer ${token}`)
      .json({
        fullName: 'First School Admin',
        email: 'first-school-admin@example.com',
        password: 'Secret123!',
      })

    response.assertStatus(200)
    const body = response.body() as any
    assert.equal(body.data.role, 'school_admin')
    assert.equal(body.data.institutionId, institutionId)
    assert.equal(body.data.email, 'first-school-admin@example.com')
  })

  test('non-super-admin cannot bootstrap school admin', async ({ client }) => {
    const institutionId = await createInstitution()

    await User.create({
      email: 'teacher-bootstrap@example.com',
      password: 'Secret123!',
      fullName: 'Teacher Bootstrap',
    })
    const teacher = await User.findByOrFail('email', 'teacher-bootstrap@example.com')
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'teacher-bootstrap@example.com',
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as any).data.token as string

    const response = await client
      .post(`/api/v1/institutions/${institutionId}/bootstrap-school-admin`)
      .header('authorization', `Bearer ${token}`)
      .json({
        fullName: 'Should Fail',
        email: 'should-fail@example.com',
        password: 'Secret123!',
      })

    response.assertStatus(403)
    response.assertBodyContains({
      error: {
        code: 'FORBIDDEN_ROLE',
      },
    })
  })
})
