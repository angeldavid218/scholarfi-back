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
      name: `Student List Institution ${codeSuffix}`,
      code: `STU-${codeSuffix}`,
      status: 'active',
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

test.group('Tasks list student', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('student sees only active eligible tasks in own institution', async ({ client, assert }) => {
    const institutionA = await createInstitution(`A-${Date.now()}`)
    const institutionB = await createInstitution(`B-${Date.now()}`)

    const teacher = await User.create({
      email: 'student-list-teacher@example.com',
      password: 'Secret123!',
      fullName: 'Student List Teacher',
      institutionId: institutionA,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const student = await User.create({
      email: 'student-list-user@example.com',
      password: 'Secret123!',
      fullName: 'Student List User',
      institutionId: institutionA,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    await db.table('tasks').insert([
      {
        institution_id: institutionA,
        created_by_teacher_id: teacher.id,
        title: 'Eligible Active Task',
        description: 'Visible task',
        reward_amount: 100,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      },
      {
        institution_id: institutionA,
        created_by_teacher_id: teacher.id,
        title: 'Closed Task',
        description: 'Not eligible',
        reward_amount: 80,
        due_at: null,
        status: 'closed',
        created_at: new Date(),
        updated_at: null,
      },
      {
        institution_id: institutionB,
        created_by_teacher_id: teacher.id,
        title: 'Other Institution Task',
        description: 'Cross tenant',
        reward_amount: 90,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      },
    ])

    const login = await client.post('/api/v1/auth/login').json({
      email: 'student-list-user@example.com',
      password: 'Secret123!',
    })
    const token = (login.body() as any).data.token as string

    const response = await client
      .get('/api/v1/tasks/available')
      .header('authorization', `Bearer ${token}`)
    response.assertStatus(200)
    const body = response.body() as any

    assert.equal(body.data.length, 1)
    assert.equal(body.data[0].title, 'Eligible Active Task')
    assert.equal(body.data[0].status, 'active')
  })
})
