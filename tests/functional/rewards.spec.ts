import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { seedReleasedFunding } from '../helpers/released_funding.ts'

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

async function createInstitution(codePrefix: string) {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `Institution ${codePrefix}`,
      code: `${codePrefix}-${Date.now()}`,
      status: 'active',
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

async function loginToken(client: any, email: string) {
  const response = await client.post('/api/v1/auth/login').json({
    email,
    password: 'Secret123!',
  })
  return (response.body() as any).data.token as string
}

test.group('Rewards and balance flows', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('idempotent reward repost does not duplicate transaction or balance', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution('RW-IDP')
    await seedReleasedFunding(institutionId, 1000)

    const teacher = await User.create({
      email: 'rw-teacher-1@example.com',
      password: 'Secret123!',
      fullName: 'Rewards Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const admin = await User.create({
      email: 'rw-admin-1@example.com',
      password: 'Secret123!',
      fullName: 'Rewards Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const student = await User.create({
      email: 'rw-student-1@example.com',
      password: 'Secret123!',
      fullName: 'Rewards Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacher.id,
        title: 'Rewarded Task',
        description: 'Reward path',
        reward_amount: 30,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const task = taskInsert[0] as any
    const taskId = typeof task === 'number' ? task : task.id

    const studentToken = await loginToken(client, student.email)
    const createSubmission = await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({ taskId, evidenceText: 'Reward evidence' })
    const submissionId = (createSubmission.body() as any).data.id as number

    const teacherToken = await loginToken(client, teacher.email)
    await client
      .patch(`/api/v1/submissions/${submissionId}/teacher-action`)
      .header('authorization', `Bearer ${teacherToken}`)
      .json({ action: 'validate' })
      .then((res) => res.assertStatus(200))

    const adminToken = await loginToken(client, admin.email)
    await client
      .patch(`/api/v1/submissions/${submissionId}/admin-decision`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({ decision: 'approve' })
      .then((res) => res.assertStatus(200))

    const repostResponse = await client
      .post(`/api/v1/rewards/post/${submissionId}`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({})

    repostResponse.assertStatus(200)
    assert.equal((repostResponse.body() as any).data.idempotent, true)

    const rewards = await db.from('reward_transactions').where('submission_id', submissionId)
    assert.lengthOf(rewards, 1)
    const balance = await db
      .from('simulated_balances')
      .where('institution_id', institutionId)
      .andWhere('student_id', student.id)
      .first()
    assert.equal(Number(balance.balance), 30)
  })

  test('student balance and admin history are institution scoped', async ({ client, assert }) => {
    const institutionA = await createInstitution('RW-SCP-A')
    const institutionB = await createInstitution('RW-SCP-B')

    const studentA = await User.create({
      email: 'rw-student-2@example.com',
      password: 'Secret123!',
      fullName: 'Student A',
      institutionId: institutionA,
      isActive: true,
    })
    await assignRoleToUser(studentA.id, 'student', 'Student')

    const adminA = await User.create({
      email: 'rw-admin-2@example.com',
      password: 'Secret123!',
      fullName: 'Admin A',
      institutionId: institutionA,
      isActive: true,
    })
    await assignRoleToUser(adminA.id, 'school_admin', 'School Admin')

    const adminB = await User.create({
      email: 'rw-admin-3@example.com',
      password: 'Secret123!',
      fullName: 'Admin B',
      institutionId: institutionB,
      isActive: true,
    })
    await assignRoleToUser(adminB.id, 'school_admin', 'School Admin')

    const studentB = await User.create({
      email: 'rw-student-3@example.com',
      password: 'Secret123!',
      fullName: 'Student B',
      institutionId: institutionB,
      isActive: true,
    })
    await assignRoleToUser(studentB.id, 'student', 'Student')

    const teacherA = await User.create({
      email: 'rw-teacher-2@example.com',
      password: 'Secret123!',
      fullName: 'Teacher A',
      institutionId: institutionA,
      isActive: true,
    })
    await assignRoleToUser(teacherA.id, 'teacher', 'Teacher')

    const teacherB = await User.create({
      email: 'rw-teacher-3@example.com',
      password: 'Secret123!',
      fullName: 'Teacher B',
      institutionId: institutionB,
      isActive: true,
    })
    await assignRoleToUser(teacherB.id, 'teacher', 'Teacher')

    const taskAInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionA,
        created_by_teacher_id: teacherA.id,
        title: 'Task A',
        description: 'A',
        reward_amount: 25,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const taskA = taskAInsert[0] as any
    const taskAId = typeof taskA === 'number' ? taskA : taskA.id

    const taskBInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionB,
        created_by_teacher_id: teacherB.id,
        title: 'Task B',
        description: 'B',
        reward_amount: 50,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const taskB = taskBInsert[0] as any
    const taskBId = typeof taskB === 'number' ? taskB : taskB.id

    const submissionAInsert = await db
      .table('submissions')
      .insert({
        institution_id: institutionA,
        task_id: taskAId,
        student_id: studentA.id,
        evidence_text: 'A',
        evidence_url: null,
        status: 'approved',
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const submissionA = submissionAInsert[0] as any
    const submissionAId = typeof submissionA === 'number' ? submissionA : submissionA.id

    const submissionBInsert = await db
      .table('submissions')
      .insert({
        institution_id: institutionB,
        task_id: taskBId,
        student_id: studentB.id,
        evidence_text: 'B',
        evidence_url: null,
        status: 'approved',
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const submissionB = submissionBInsert[0] as any
    const submissionBId = typeof submissionB === 'number' ? submissionB : submissionB.id

    await db.table('simulated_balances').insert([
      {
        institution_id: institutionA,
        student_id: studentA.id,
        balance: 45,
        created_at: new Date(),
        updated_at: null,
      },
      {
        institution_id: institutionB,
        student_id: studentB.id,
        balance: 999,
        created_at: new Date(),
        updated_at: null,
      },
    ])

    await db.table('reward_transactions').insert([
      {
        institution_id: institutionA,
        submission_id: submissionAId,
        student_id: studentA.id,
        amount: 25,
        type: 'credit',
        status: 'posted',
        posted_at: new Date(),
        created_at: new Date(),
        updated_at: null,
      },
      {
        institution_id: institutionB,
        submission_id: submissionBId,
        student_id: studentB.id,
        amount: 50,
        type: 'credit',
        status: 'posted',
        posted_at: new Date(),
        created_at: new Date(),
        updated_at: null,
      },
    ])

    const studentToken = await loginToken(client, studentA.email)
    const balanceResponse = await client
      .get('/api/v1/rewards/balance')
      .header('authorization', `Bearer ${studentToken}`)
    balanceResponse.assertStatus(200)
    assert.equal((balanceResponse.body() as any).data.simulatedBalance, 45)

    const adminAToken = await loginToken(client, adminA.email)
    const historyA = await client
      .get('/api/v1/rewards/history')
      .header('authorization', `Bearer ${adminAToken}`)
    historyA.assertStatus(200)
    assert.lengthOf((historyA.body() as any).data.items, 1)
    assert.equal((historyA.body() as any).data.items[0].institutionId, institutionA)
    assert.equal((historyA.body() as any).data.meta.currentPage, 1)

    const summaryA = await client
      .get('/api/v1/rewards/history/summary')
      .header('authorization', `Bearer ${adminAToken}`)
    summaryA.assertStatus(200)
    assert.equal((summaryA.body() as any).data.transactionCount, 1)
    assert.equal(Number((summaryA.body() as any).data.creditsTotal), 25)

    const adminBToken = await loginToken(client, adminB.email)
    const historyB = await client
      .get('/api/v1/rewards/history')
      .header('authorization', `Bearer ${adminBToken}`)
    historyB.assertStatus(200)
    assert.lengthOf((historyB.body() as any).data.items, 1)
    assert.equal((historyB.body() as any).data.items[0].institutionId, institutionB)
    assert.equal((historyB.body() as any).data.meta.currentPage, 1)
  })
})
