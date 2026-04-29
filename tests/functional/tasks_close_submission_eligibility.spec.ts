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
      name: `Close Institution ${Date.now()}`,
      code: `CLS-${Date.now()}`,
      status: 'active',
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

test.group('Task closure and submission eligibility', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('student can submit valid evidence for active eligible task', async ({ client, assert }) => {
    const institutionId = await createInstitution()

    const teacher = await User.create({
      email: 'submit-teacher@example.com',
      password: 'Secret123!',
      fullName: 'Submit Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const student = await User.create({
      email: 'submit-student@example.com',
      password: 'Secret123!',
      fullName: 'Submit Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacher.id,
        title: 'Submittable Task',
        description: 'Open task',
        reward_amount: 75,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const task = taskInsert[0] as any
    const taskId = typeof task === 'number' ? task : task.id

    const studentLogin = await client.post('/api/v1/auth/login').json({
      email: 'submit-student@example.com',
      password: 'Secret123!',
    })
    const studentToken = (studentLogin.body() as any).data.token as string

    const submitResponse = await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({
        taskId,
        evidenceText: 'Completed assignment',
        evidenceUrl: 'https://example.com/evidence',
      })

    submitResponse.assertStatus(200)
    const body = submitResponse.body() as any
    assert.equal(body.data.taskId, taskId)
    assert.equal(body.data.studentId, student.id)
    assert.equal(body.data.status, 'pending')
  })

  test('teacher can close task and closed task rejects submissions', async ({ client, assert }) => {
    const institutionId = await createInstitution()

    const teacher = await User.create({
      email: 'close-teacher@example.com',
      password: 'Secret123!',
      fullName: 'Close Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const student = await User.create({
      email: 'close-student@example.com',
      password: 'Secret123!',
      fullName: 'Close Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacher.id,
        title: 'Closable Task',
        description: 'Close me',
        reward_amount: 100,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const task = taskInsert[0] as any
    const taskId = typeof task === 'number' ? task : task.id

    const teacherLogin = await client.post('/api/v1/auth/login').json({
      email: 'close-teacher@example.com',
      password: 'Secret123!',
    })
    const teacherToken = (teacherLogin.body() as any).data.token as string

    const closeResponse = await client
      .patch(`/api/v1/tasks/${taskId}/close`)
      .header('authorization', `Bearer ${teacherToken}`)
      .json({})

    closeResponse.assertStatus(200)
    assert.equal((closeResponse.body() as any).data.status, 'closed')

    const studentLogin = await client.post('/api/v1/auth/login').json({
      email: 'close-student@example.com',
      password: 'Secret123!',
    })
    const studentToken = (studentLogin.body() as any).data.token as string

    const submitResponse = await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({
        taskId,
        evidenceText: 'My evidence',
      })

    submitResponse.assertStatus(422)
    submitResponse.assertBodyContains({
      error: {
        code: 'TASK_NOT_ELIGIBLE_FOR_SUBMISSION',
      },
    })

    const submissions = await db.from('submissions').where('task_id', taskId)
    assert.equal(submissions.length, 0)
  })
})
