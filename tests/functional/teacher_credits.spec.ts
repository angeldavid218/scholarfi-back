import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { seedInstitutionCredits } from '../helpers/institution_credits.js'
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

test.group('Teacher credit pools', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('school admin can allocate equally and manually', async ({ client, assert }) => {
    const institutionId = await createInstitution('TCHR-ALLOC')
    await seedInstitutionCredits(institutionId, 1000)

    const admin = await User.create({
      email: 'tchr-admin@example.com',
      password: 'Secret123!',
      fullName: 'Teacher Budget Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const teachers = await Promise.all(
      [1, 2, 3].map(async (n) => {
        const teacher = await User.create({
          email: `tchr-${n}@example.com`,
          password: 'Secret123!',
          fullName: `Teacher ${n}`,
          institutionId,
          isActive: true,
        })
        await assignRoleToUser(teacher.id, 'teacher', 'Teacher')
        return teacher
      })
    )

    const adminToken = await loginToken(client, admin.email)

    const equalRes = await client
      .post('/api/v1/institutions/teacher-credit-pools/allocate-equal')
      .header('authorization', `Bearer ${adminToken}`)
      .json({ totalAmount: 300, notes: 'Equal pilot' })

    equalRes.assertStatus(200)
    const equalBody = equalRes.body() as any
    assert.equal(equalBody.data.perTeacherAmount, 100)
    assert.equal(equalBody.data.teachersAffected, 3)
    assert.equal(equalBody.data.remainder, 0)
    assert.equal(equalBody.data.breakdown.delegatedCredits, 300)
    assert.equal(equalBody.data.breakdown.availableToAssign, 700)

    const manualRes = await client
      .post(`/api/v1/institutions/teacher-credit-pools/${teachers[0].id}/allocate`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({ amount: 50 })

    manualRes.assertStatus(200)
    assert.equal((manualRes.body() as any).data.breakdown.delegatedCredits, 350)
    assert.equal((manualRes.body() as any).data.breakdown.availableToAssign, 650)

    const listRes = await client
      .get('/api/v1/institutions/teacher-credit-pools')
      .header('authorization', `Bearer ${adminToken}`)

    listRes.assertStatus(200)
    const teacherRows = (listRes.body() as any).data.teachers as Array<{
      teacherId: number
      allocatedCredits: number
    }>
    const first = teacherRows.find((row) => row.teacherId === teachers[0].id)
    assert.equal(first?.allocatedCredits, 150)
  })

  test('cannot allocate more than institution available to assign', async ({ client }) => {
    const institutionId = await createInstitution('TCHR-OVER')
    await seedInstitutionCredits(institutionId, 100)

    const admin = await User.create({
      email: 'tchr-over-admin@example.com',
      password: 'Secret123!',
      fullName: 'Over Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const teacher = await User.create({
      email: 'tchr-over@example.com',
      password: 'Secret123!',
      fullName: 'Over Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const adminToken = await loginToken(client, admin.email)
    const response = await client
      .post(`/api/v1/institutions/teacher-credit-pools/${teacher.id}/allocate`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({ amount: 200 })

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'INSUFFICIENT_INSTITUTION_BUDGET_TO_ASSIGN' } })
  })

  test('teacher with budget auto-approves on validation', async ({ client, assert }) => {
    const institutionId = await createInstitution('TCHR-AUTO')
    await seedInstitutionCredits(institutionId, 500)

    const admin = await User.create({
      email: 'tchr-auto-admin@example.com',
      password: 'Secret123!',
      fullName: 'Auto Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const teacher = await User.create({
      email: 'tchr-auto@example.com',
      password: 'Secret123!',
      fullName: 'Auto Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const student = await User.create({
      email: 'tchr-auto-student@example.com',
      password: 'Secret123!',
      fullName: 'Auto Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const adminToken = await loginToken(client, admin.email)
    await client
      .post(`/api/v1/institutions/teacher-credit-pools/${teacher.id}/allocate`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({ amount: 100 })
      .then((res) => res.assertStatus(200))

    const teacherToken = await loginToken(client, teacher.email)
    const taskRes = await client
      .post('/api/v1/tasks')
      .header('authorization', `Bearer ${teacherToken}`)
      .json({
        title: 'Auto approve task',
        description: 'Uses teacher budget',
        rewardAmount: 25,
      })
    taskRes.assertStatus(200)
    const taskId = (taskRes.body() as any).data.id as number

    const studentToken = await loginToken(client, student.email)
    const submissionRes = await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({ taskId, evidenceText: 'Done with teacher budget' })
    const submissionId = (submissionRes.body() as any).data.id as number

    const validateRes = await client
      .patch(`/api/v1/submissions/${submissionId}/teacher-action`)
      .header('authorization', `Bearer ${teacherToken}`)
      .json({ action: 'validate' })

    validateRes.assertStatus(200)
    const validateBody = validateRes.body() as any
    assert.equal(validateBody.data.status, 'approved')
    assert.equal(validateBody.data.autoApproved, true)
    assert.isNumber(validateBody.data.rewardTransactionId)

    const adminQueue = await client
      .get('/api/v1/submissions/admin-queue')
      .header('authorization', `Bearer ${adminToken}`)
    adminQueue.assertStatus(200)
    assert.lengthOf((adminQueue.body() as any).data.items, 0)

    const teacherPool = await db
      .from('teacher_credit_pools')
      .where('teacher_id', teacher.id)
      .first()
    assert.equal(Number(teacherPool.allocated_credits), 100)
    assert.equal(Number(teacherPool.utilized_credits), 25)

    const institutionPool = await db
      .from('institution_credit_pools')
      .where('institution_id', institutionId)
      .first()
    assert.equal(Number(institutionPool.utilized_credits), 0)
  })

  test('teacher without budget still routes to admin queue', async ({ client, assert }) => {
    const institutionId = await createInstitution('TCHR-QUEUE')
    await seedInstitutionCredits(institutionId, 500)

    const admin = await User.create({
      email: 'tchr-queue-admin@example.com',
      password: 'Secret123!',
      fullName: 'Queue Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const teacher = await User.create({
      email: 'tchr-queue@example.com',
      password: 'Secret123!',
      fullName: 'Queue Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const student = await User.create({
      email: 'tchr-queue-student@example.com',
      password: 'Secret123!',
      fullName: 'Queue Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacher.id,
        title: 'No teacher budget task',
        description: 'Needs admin',
        reward_amount: 25,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const taskId = (taskInsert[0] as any).id ?? taskInsert[0]

    const studentToken = await loginToken(client, student.email)
    const submissionRes = await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({ taskId, evidenceText: 'Needs admin approval' })
    const submissionId = (submissionRes.body() as any).data.id as number

    const teacherToken = await loginToken(client, teacher.email)
    const validateRes = await client
      .patch(`/api/v1/submissions/${submissionId}/teacher-action`)
      .header('authorization', `Bearer ${teacherToken}`)
      .json({ action: 'validate' })

    validateRes.assertStatus(200)
    assert.equal((validateRes.body() as any).data.status, 'validated')
    assert.notProperty((validateRes.body() as any).data, 'autoApproved')

    const adminToken = await loginToken(client, admin.email)
    const adminQueue = await client
      .get('/api/v1/submissions/admin-queue')
      .header('authorization', `Bearer ${adminToken}`)
    adminQueue.assertStatus(200)
    assert.lengthOf((adminQueue.body() as any).data.items, 1)
  })

  test('task creation uses teacher pool when teacher has budget', async ({ client }) => {
    const institutionId = await createInstitution('TCHR-TASK')
    await seedInstitutionCredits(institutionId, 500)

    const admin = await User.create({
      email: 'tchr-task-admin@example.com',
      password: 'Secret123!',
      fullName: 'Task Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const teacher = await User.create({
      email: 'tchr-task@example.com',
      password: 'Secret123!',
      fullName: 'Task Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const adminToken = await loginToken(client, admin.email)
    await client
      .post(`/api/v1/institutions/teacher-credit-pools/${teacher.id}/allocate`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({ amount: 30 })
      .then((res) => res.assertStatus(200))

    const teacherToken = await loginToken(client, teacher.email)
    const blocked = await client
      .post('/api/v1/tasks')
      .header('authorization', `Bearer ${teacherToken}`)
      .json({
        title: 'Too expensive for teacher pool',
        description: 'Should fail',
        rewardAmount: 50,
      })

    blocked.assertStatus(422)
    blocked.assertBodyContains({ error: { code: 'INSUFFICIENT_TEACHER_CREDITS' } })

    const ok = await client
      .post('/api/v1/tasks')
      .header('authorization', `Bearer ${teacherToken}`)
      .json({
        title: 'Affordable task',
        description: 'Within teacher budget',
        rewardAmount: 20,
      })

    ok.assertStatus(200)
  })

  test('teacher can view own credit pool', async ({ client, assert }) => {
    const institutionId = await createInstitution('TCHR-VIEW')
    await seedInstitutionCredits(institutionId, 200)

    const admin = await User.create({
      email: 'tchr-view-admin@example.com',
      password: 'Secret123!',
      fullName: 'View Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const teacher = await User.create({
      email: 'tchr-view@example.com',
      password: 'Secret123!',
      fullName: 'View Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const adminToken = await loginToken(client, admin.email)
    await client
      .post(`/api/v1/institutions/teacher-credit-pools/${teacher.id}/allocate`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({ amount: 80 })
      .then((res) => res.assertStatus(200))

    const teacherToken = await loginToken(client, teacher.email)
    const poolRes = await client
      .get('/api/v1/teachers/credit-pool')
      .header('authorization', `Bearer ${teacherToken}`)

    poolRes.assertStatus(200)
    const body = poolRes.body() as any
    assert.equal(body.data.allocatedCredits, 80)
    assert.equal(body.data.remainingCredits, 80)
    assert.equal(body.data.hasPool, true)
  })
})
