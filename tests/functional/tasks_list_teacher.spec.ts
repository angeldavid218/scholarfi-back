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
      name: `List Institution ${codeSuffix}`,
      code: `LST-${codeSuffix}`,
      status: 'active',
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

test.group('Tasks list teacher', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('teacher sees only own institution-scoped tasks with statuses', async ({
    client,
    assert,
  }) => {
    const institutionA = await createInstitution(`A-${Date.now()}`)
    const institutionB = await createInstitution(`B-${Date.now()}`)

    const teacherA = await User.create({
      email: 'list-teacher-a@example.com',
      password: 'Secret123!',
      fullName: 'List Teacher A',
      institutionId: institutionA,
      isActive: true,
    })
    await assignRoleToUser(teacherA.id, 'teacher', 'Teacher')

    const teacherB = await User.create({
      email: 'list-teacher-b@example.com',
      password: 'Secret123!',
      fullName: 'List Teacher B',
      institutionId: institutionA,
      isActive: true,
    })
    await assignRoleToUser(teacherB.id, 'teacher', 'Teacher')

    await db.table('tasks').insert([
      {
        institution_id: institutionA,
        created_by_teacher_id: teacherA.id,
        title: 'Task A1',
        description: 'Teacher A active task',
        reward_amount: 100,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      },
      {
        institution_id: institutionA,
        created_by_teacher_id: teacherA.id,
        title: 'Task A2',
        description: 'Teacher A closed task',
        reward_amount: 80,
        due_at: null,
        status: 'closed',
        created_at: new Date(),
        updated_at: null,
      },
      {
        institution_id: institutionA,
        created_by_teacher_id: teacherB.id,
        title: 'Task B1',
        description: 'Teacher B task',
        reward_amount: 70,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      },
      {
        institution_id: institutionB,
        created_by_teacher_id: teacherA.id,
        title: 'Cross Tenant Task',
        description: 'Different institution',
        reward_amount: 90,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      },
    ])

    const login = await client.post('/api/v1/auth/login').json({
      email: 'list-teacher-a@example.com',
      password: 'Secret123!',
    })
    const token = (login.body() as any).data.token as string

    const response = await client.get('/api/v1/tasks').header('authorization', `Bearer ${token}`)
    response.assertStatus(200)
    const body = response.body() as any
    assert.equal(body.data.items.length, 2)
    assert.equal(body.data.meta.total, 2)
    assert.equal(body.data.meta.currentPage, 1)

    const titles = body.data.items.map((task: any) => task.title).sort()
    assert.deepEqual(titles, ['Task A1', 'Task A2'])

    const statuses = body.data.items.map((task: any) => task.status).sort()
    assert.deepEqual(statuses, ['active', 'closed'])

    const summary = await client.get('/api/v1/tasks/summary').header('authorization', `Bearer ${token}`)
    summary.assertStatus(200)
    assert.equal((summary.body() as any).data.total, 2)
    assert.equal((summary.body() as any).data.closed, 1)
  })
})
