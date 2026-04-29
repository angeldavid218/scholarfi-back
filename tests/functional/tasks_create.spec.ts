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

async function createInstitution(status: 'active' | 'inactive') {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `Task Institution ${Date.now()}`,
      code: `TASK-${Date.now()}`,
      status,
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

test.group('Tasks create', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('teacher creates task in active institution', async ({ client, assert }) => {
    const institutionId = await createInstitution('active')
    const teacher = await User.create({
      email: 'task-teacher@example.com',
      password: 'Secret123!',
      fullName: 'Task Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const login = await client.post('/api/v1/auth/login').json({
      email: 'task-teacher@example.com',
      password: 'Secret123!',
    })
    const token = (login.body() as any).data.token as string

    const response = await client
      .post('/api/v1/tasks')
      .header('authorization', `Bearer ${token}`)
      .json({
        title: 'Math assignment',
        description: 'Complete chapter exercises',
        rewardAmount: 100,
      })

    response.assertStatus(200)
    const body = response.body() as any
    assert.equal(body.data.title, 'Math assignment')
    assert.equal(body.data.institutionId, institutionId)
    assert.equal(body.data.createdByTeacherId, teacher.id)
  })

  test('teacher cannot create task when institution is inactive', async ({ client }) => {
    const institutionId = await createInstitution('inactive')
    const teacher = await User.create({
      email: 'inactive-task-teacher@example.com',
      password: 'Secret123!',
      fullName: 'Inactive Task Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const login = await client.post('/api/v1/auth/login').json({
      email: 'inactive-task-teacher@example.com',
      password: 'Secret123!',
    })
    const token = (login.body() as any).data.token as string

    const response = await client
      .post('/api/v1/tasks')
      .header('authorization', `Bearer ${token}`)
      .json({
        title: 'Blocked task',
        description: 'Should fail',
        rewardAmount: 50,
      })

    response.assertStatus(403)
    response.assertBodyContains({
      error: {
        code: 'INSTITUTION_INACTIVE',
      },
    })
  })
})
