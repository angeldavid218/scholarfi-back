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

async function createInstitution(status: 'active' | 'inactive' | 'draft' = 'active') {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `Provision Institution ${Date.now()}`,
      code: `PROV-${Date.now()}`,
      status,
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

test.group('Institutions provision users', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('school admin provisions teacher in own active institution', async ({ client, assert }) => {
    const institutionId = await createInstitution('active')

    const schoolAdmin = await User.create({
      email: 'school-admin-provision@example.com',
      password: 'Secret123!',
      fullName: 'School Admin Provision',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(schoolAdmin.id, 'school_admin', 'School Admin')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'school-admin-provision@example.com',
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as any).data.token as string

    const response = await client
      .post('/api/v1/institutions/users')
      .header('authorization', `Bearer ${token}`)
      .json({
        fullName: 'Provisioned Teacher',
        email: 'provisioned-teacher@example.com',
        password: 'Secret123!',
        role: 'teacher',
      })

    response.assertStatus(200)
    const body = response.body() as any
    assert.equal(body.data.role, 'teacher')
    assert.equal(body.data.institutionId, institutionId)
  })

  test('school admin cannot provision users when institution is inactive', async ({ client }) => {
    const institutionId = await createInstitution('inactive')

    const schoolAdmin = await User.create({
      email: 'school-admin-inactive@example.com',
      password: 'Secret123!',
      fullName: 'School Admin Inactive',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(schoolAdmin.id, 'school_admin', 'School Admin')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'school-admin-inactive@example.com',
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as any).data.token as string

    const response = await client
      .post('/api/v1/institutions/users')
      .header('authorization', `Bearer ${token}`)
      .json({
        fullName: 'Should Not Create',
        email: 'should-not-create@example.com',
        password: 'Secret123!',
        role: 'student',
      })

    response.assertStatus(403)
    response.assertBodyContains({
      error: {
        code: 'INSTITUTION_INACTIVE',
      },
    })
  })

  test('school admin lists institution users with search scoped to institution', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution('active')
    const otherInsert = await db
      .table('institutions')
      .insert({
        name: `Other Institution ${Date.now()}`,
        code: `PROV-OTHER-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        status: 'active',
        created_by: null,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const otherCreated = otherInsert[0] as any
    const otherInstitutionId = typeof otherCreated === 'number' ? otherCreated : otherCreated.id

    const schoolAdmin = await User.create({
      email: 'school-admin-list@example.com',
      password: 'Secret123!',
      fullName: 'Admin Lister',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(schoolAdmin.id, 'school_admin', 'School Admin')

    const teacher = await User.create({
      email: 'list-teacher-x@example.com',
      password: 'Secret123!',
      fullName: 'Ana Busqueda Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const student = await User.create({
      email: 'list-student-x@example.com',
      password: 'Secret123!',
      fullName: 'Bruno Otro Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    await User.create({
      email: 'other-inst-user@example.com',
      password: 'Secret123!',
      fullName: 'Ana Fuera',
      institutionId: otherInstitutionId,
      isActive: true,
    })

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'school-admin-list@example.com',
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as any).data.token as string

    const listResponse = await client
      .get('/api/v1/institutions/users')
      .header('authorization', `Bearer ${token}`)
    listResponse.assertStatus(200)
    const body = listResponse.body() as any
    assert.equal(body.data.meta.total, 3)
    assert.lengthOf(body.data.items, 3)

    const searchResponse = await client
      .get('/api/v1/institutions/users?search=Ana')
      .header('authorization', `Bearer ${token}`)
    searchResponse.assertStatus(200)
    const searchBody = searchResponse.body() as any
    assert.equal(searchBody.data.meta.total, 1)
    assert.equal(searchBody.data.items[0].fullName, 'Ana Busqueda Teacher')
    assert.deepEqual(searchBody.data.items[0].roles.sort(), ['teacher'])
  })
})
