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

test.group('Institution credit pools', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('super admin allocates credits and school admin can view pool', async ({ client, assert }) => {
    const institutionId = await createInstitution('POOL-VIEW')

    const superAdmin = await User.create({
      email: 'pool-super@example.com',
      password: 'Secret123!',
      fullName: 'Pool Super',
      institutionId: null,
      isActive: true,
    })
    await assignRoleToUser(superAdmin.id, 'super_admin', 'Super Admin')

    const schoolAdmin = await User.create({
      email: 'pool-admin@example.com',
      password: 'Secret123!',
      fullName: 'Pool Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(schoolAdmin.id, 'school_admin', 'School Admin')

    const superToken = await loginToken(client, superAdmin.email)
    const allocate = await client
      .post(`/api/v1/institutions/${institutionId}/credit-pool/allocate`)
      .header('authorization', `Bearer ${superToken}`)
      .json({ amount: 1000, notes: 'Pilot allocation' })

    allocate.assertStatus(200)
    assert.equal((allocate.body() as any).data.remainingCredits, 1000)

    const adminToken = await loginToken(client, schoolAdmin.email)
    const pool = await client
      .get('/api/v1/institutions/credit-pool')
      .header('authorization', `Bearer ${adminToken}`)

    pool.assertStatus(200)
    const body = pool.body() as any
    assert.equal(body.data.allocatedCredits, 1000)
    assert.equal(body.data.remainingCredits, 1000)
  })

  test('approval fails when institution pool is exhausted', async ({ client, assert }) => {
    const institutionId = await createInstitution('POOL-EXH')

    const superAdmin = await User.create({
      email: 'pool-ex-super@example.com',
      password: 'Secret123!',
      fullName: 'Pool Ex Super',
      institutionId: null,
      isActive: true,
    })
    await assignRoleToUser(superAdmin.id, 'super_admin', 'Super Admin')
    await seedInstitutionCredits(institutionId, 10)

    const teacher = await User.create({
      email: 'pool-ex-teacher@example.com',
      password: 'Secret123!',
      fullName: 'Pool Ex Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const admin = await User.create({
      email: 'pool-ex-admin@example.com',
      password: 'Secret123!',
      fullName: 'Pool Ex Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const student = await User.create({
      email: 'pool-ex-student@example.com',
      password: 'Secret123!',
      fullName: 'Pool Ex Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacher.id,
        title: 'Big reward',
        description: 'Exceeds pool',
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
      .json({ taskId, evidenceText: 'Done' })
    const submissionId = (submissionRes.body() as any).data.id as number

    const teacherToken = await loginToken(client, teacher.email)
    await client
      .patch(`/api/v1/submissions/${submissionId}/teacher-action`)
      .header('authorization', `Bearer ${teacherToken}`)
      .json({ action: 'validate' })
      .then((res) => res.assertStatus(200))

    const adminToken = await loginToken(client, admin.email)
    const approve = await client
      .patch(`/api/v1/submissions/${submissionId}/admin-decision`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({ decision: 'approve' })

    approve.assertStatus(422)
    approve.assertBodyContains({
      error: { code: 'INSUFFICIENT_INSTITUTION_CREDITS' },
    })

    const submission = await db.from('submissions').where('id', submissionId).first()
    assert.equal(submission.status, 'validated')
  })

  test('task creation blocked when reward exceeds remaining pool', async ({ client }) => {
    const institutionId = await createInstitution('POOL-TASK')

    const superAdmin = await User.create({
      email: 'pool-task-super@example.com',
      password: 'Secret123!',
      fullName: 'Pool Task Super',
      institutionId: null,
      isActive: true,
    })
    await assignRoleToUser(superAdmin.id, 'super_admin', 'Super Admin')
    await seedInstitutionCredits(institutionId, 20)

    const teacher = await User.create({
      email: 'pool-task-teacher@example.com',
      password: 'Secret123!',
      fullName: 'Pool Task Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const teacherToken = await loginToken(client, teacher.email)
    const response = await client
      .post('/api/v1/tasks')
      .header('authorization', `Bearer ${teacherToken}`)
      .json({
        title: 'Too expensive task',
        description: 'Costs more than pool',
        rewardAmount: 50,
      })

    response.assertStatus(422)
    response.assertBodyContains({
      error: { code: 'INSUFFICIENT_INSTITUTION_CREDITS' },
    })
  })
})
