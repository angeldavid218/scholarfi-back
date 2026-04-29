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

async function createInstitution(codeSuffix: string) {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `RoleAssoc Institution ${codeSuffix}`,
      code: `RA-${codeSuffix}`,
      status: 'active',
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

test.group('Institutions role assignment and association', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('school admin assigns role and creates teacher-student association in tenant', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution(String(Date.now()))

    const schoolAdmin = await User.create({
      email: 'school-admin-assoc@example.com',
      password: 'Secret123!',
      fullName: 'School Admin Assoc',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(schoolAdmin.id, 'school_admin', 'School Admin')

    const teacher = await User.create({
      email: 'assoc-teacher@example.com',
      password: 'Secret123!',
      fullName: 'Assoc Teacher',
      institutionId,
      isActive: true,
    })
    const student = await User.create({
      email: 'assoc-student@example.com',
      password: 'Secret123!',
      fullName: 'Assoc Student',
      institutionId,
      isActive: true,
    })

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'school-admin-assoc@example.com',
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as any).data.token as string

    const roleResponse = await client
      .patch(`/api/v1/institutions/users/${teacher.id}/role`)
      .header('authorization', `Bearer ${token}`)
      .json({ role: 'teacher' })
    roleResponse.assertStatus(200)
    assert.equal((roleResponse.body() as any).data.role, 'teacher')

    const associationResponse = await client
      .post('/api/v1/institutions/teacher-students')
      .header('authorization', `Bearer ${token}`)
      .json({
        teacherId: teacher.id,
        studentId: student.id,
      })
    associationResponse.assertStatus(200)
    const body = associationResponse.body() as any
    assert.equal(body.data.institutionId, institutionId)
    assert.equal(body.data.teacherId, teacher.id)
    assert.equal(body.data.studentId, student.id)
  })

  test('school admin cannot assign role to user outside tenant', async ({ client }) => {
    const institutionA = await createInstitution(`A-${Date.now()}`)
    const institutionB = await createInstitution(`B-${Date.now()}`)

    const schoolAdmin = await User.create({
      email: 'school-admin-tenant-a@example.com',
      password: 'Secret123!',
      fullName: 'School Admin Tenant A',
      institutionId: institutionA,
      isActive: true,
    })
    await assignRoleToUser(schoolAdmin.id, 'school_admin', 'School Admin')

    const outsideUser = await User.create({
      email: 'outside-user@example.com',
      password: 'Secret123!',
      fullName: 'Outside User',
      institutionId: institutionB,
      isActive: true,
    })

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'school-admin-tenant-a@example.com',
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as any).data.token as string

    const response = await client
      .patch(`/api/v1/institutions/users/${outsideUser.id}/role`)
      .header('authorization', `Bearer ${token}`)
      .json({ role: 'teacher' })

    response.assertStatus(403)
    response.assertBodyContains({
      error: {
        code: 'TENANT_SCOPE_VIOLATION',
      },
    })
  })
})
