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

async function createNgo(code: string) {
  const insertNgo = await db
    .table('ngo_institutions')
    .insert({
      name: `NGO ${code}`,
      code,
      status: true,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return typeof insertNgo[0] === 'number' ? insertNgo[0] : (insertNgo[0] as any).id
}

async function loginToken(client: any, email: string) {
  const response = await client.post('/api/v1/auth/login').json({
    email,
    password: 'Secret123!',
  })
  return (response.body() as any).data.token as string
}

test.group('School funding balance', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('activating draft program without allocations returns NO_ALLOCATIONS', async ({ client }) => {
    const ngoId = await createNgo(`NGO-SF-NOALLOC-${Date.now()}`)
    const programInsert = await db
      .table('funding_programs')
      .insert({
        ngo_institution_id: ngoId,
        name: 'Draft Program',
        description: 'No schools yet',
        total_budget: 5000,
        allocation_type: 'equal',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'draft',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const programId =
      typeof programInsert[0] === 'number' ? programInsert[0] : (programInsert[0] as any).id

    const ngoAdmin = await User.create({
      email: 'ngo-sf-noalloc@example.com',
      password: 'Secret123!',
      fullName: 'NGO SF No Alloc',
      ngoInstitutionId: ngoId,
      isActive: true,
    })
    await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
    const token = await loginToken(client, ngoAdmin.email)

    const response = await client
      .patch(`/api/v1/funding-programs/${programId}`)
      .header('authorization', `Bearer ${token}`)
      .json({ status: 'active' })

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'NO_ALLOCATIONS' } })
  })

  test('activating draft program with partial allocation returns INCOMPLETE_ALLOCATION', async ({
    client,
  }) => {
    const ngoId = await createNgo(`NGO-SF-PARTIAL-${Date.now()}`)
    const schoolId = await createInstitution('SF-PARTIAL')
    const programInsert = await db
      .table('funding_programs')
      .insert({
        ngo_institution_id: ngoId,
        name: 'Partial Program',
        description: 'Partial allocation',
        total_budget: 10000,
        allocation_type: 'manual',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'draft',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const programId =
      typeof programInsert[0] === 'number' ? programInsert[0] : (programInsert[0] as any).id

    await db.table('budget_allocations').insert({
      funding_program_id: programId,
      institution_id: schoolId,
      allocated_budget: 4000,
      utilized_budget: 0,
      status: 'active',
      released_at: null,
      created_at: new Date(),
      updated_at: null,
    })

    const ngoAdmin = await User.create({
      email: 'ngo-sf-partial@example.com',
      password: 'Secret123!',
      fullName: 'NGO SF Partial',
      ngoInstitutionId: ngoId,
      isActive: true,
    })
    await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
    const token = await loginToken(client, ngoAdmin.email)

    const response = await client
      .patch(`/api/v1/funding-programs/${programId}`)
      .header('authorization', `Bearer ${token}`)
      .json({ status: 'active' })

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'INCOMPLETE_ALLOCATION' } })
  })

  test('activating draft program releases all allocations', async ({ client, assert }) => {
    const ngoId = await createNgo(`NGO-SF-RELEASE-${Date.now()}`)
    const schoolA = await createInstitution('SF-REL-A')
    const schoolB = await createInstitution('SF-REL-B')
    const programInsert = await db
      .table('funding_programs')
      .insert({
        ngo_institution_id: ngoId,
        name: 'Release Program',
        description: 'Full allocation',
        total_budget: 10000,
        allocation_type: 'manual',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'draft',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const programId =
      typeof programInsert[0] === 'number' ? programInsert[0] : (programInsert[0] as any).id

    await db.table('budget_allocations').insert([
      {
        funding_program_id: programId,
        institution_id: schoolA,
        allocated_budget: 6000,
        utilized_budget: 0,
        status: 'active',
        released_at: null,
        created_at: new Date(),
        updated_at: null,
      },
      {
        funding_program_id: programId,
        institution_id: schoolB,
        allocated_budget: 4000,
        utilized_budget: 0,
        status: 'active',
        released_at: null,
        created_at: new Date(),
        updated_at: null,
      },
    ])

    const ngoAdmin = await User.create({
      email: 'ngo-sf-release@example.com',
      password: 'Secret123!',
      fullName: 'NGO SF Release',
      ngoInstitutionId: ngoId,
      isActive: true,
    })
    await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
    const token = await loginToken(client, ngoAdmin.email)

    const response = await client
      .patch(`/api/v1/funding-programs/${programId}`)
      .header('authorization', `Bearer ${token}`)
      .json({ status: 'active' })

    response.assertStatus(200)
    assert.equal((response.body() as any).data.status, 'active')

    const rows = await db.from('budget_allocations').where('funding_program_id', programId)
    assert.lengthOf(rows, 2)
    assert.isTrue(rows.every((row) => row.released_at !== null))
  })

  test('school_admin can read funding balance for released allocations', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution('SF-BAL')
    await seedReleasedFunding(institutionId, 8000, {
      releasedAt: new Date('2026-03-01T10:00:00.000Z'),
    })

    const admin = await User.create({
      email: 'sf-balance-admin@example.com',
      password: 'Secret123!',
      fullName: 'SF Balance Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')
    const token = await loginToken(client, admin.email)

    const response = await client
      .get('/api/v1/institutions/funding-balance')
      .header('authorization', `Bearer ${token}`)

    response.assertStatus(200)
    const body = (response.body() as any).data
    assert.equal(body.availableBudget, 8000)
    assert.equal(body.allocatedBudget, 8000)
    assert.equal(body.utilizedBudget, 0)
    assert.lengthOf(body.programs, 1)
    assert.equal(body.programs[0].availableBudget, 8000)
    assert.isString(body.programs[0].releasedAt)
  })

  test('approval debits utilized budget and links reward transaction', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution('SF-DEBIT')
    const { allocationId } = await seedReleasedFunding(institutionId, 100)

    const teacher = await User.create({
      email: 'sf-debit-teacher@example.com',
      password: 'Secret123!',
      fullName: 'SF Debit Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const admin = await User.create({
      email: 'sf-debit-admin@example.com',
      password: 'Secret123!',
      fullName: 'SF Debit Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const student = await User.create({
      email: 'sf-debit-student@example.com',
      password: 'Secret123!',
      fullName: 'SF Debit Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacher.id,
        title: 'SF debit task',
        description: 'Debit',
        reward_amount: 40,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const taskId =
      typeof taskInsert[0] === 'number' ? taskInsert[0] : (taskInsert[0] as any).id

    const studentToken = await loginToken(client, student.email)
    const submissionResponse = await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({ taskId, evidenceText: 'SF debit evidence' })
    const submissionId = (submissionResponse.body() as any).data.id as number

    const teacherToken = await loginToken(client, teacher.email)
    await client
      .patch(`/api/v1/submissions/${submissionId}/teacher-action`)
      .header('authorization', `Bearer ${teacherToken}`)
      .json({ action: 'validate' })
      .then((res) => res.assertStatus(200))

    const adminToken = await loginToken(client, admin.email)
    const approveResponse = await client
      .patch(`/api/v1/submissions/${submissionId}/admin-decision`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({ decision: 'approve' })
    approveResponse.assertStatus(200)

    const allocation = await db.from('budget_allocations').where('id', allocationId).first()
    assert.equal(Number(allocation.utilized_budget), 40)

    const reward = await db.from('reward_transactions').where('submission_id', submissionId).first()
    assert.equal(Number(reward.budget_allocation_id), allocationId)

    const balanceResponse = await client
      .get('/api/v1/institutions/funding-balance')
      .header('authorization', `Bearer ${adminToken}`)
    balanceResponse.assertStatus(200)
    assert.equal((balanceResponse.body() as any).data.availableBudget, 60)
    assert.equal((balanceResponse.body() as any).data.utilizedBudget, 40)
  })

  test('approval with insufficient funding returns INSUFFICIENT_FUNDING_BALANCE', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution('SF-INSUF')
    await seedReleasedFunding(institutionId, 10)

    const teacher = await User.create({
      email: 'sf-insuf-teacher@example.com',
      password: 'Secret123!',
      fullName: 'SF Insuf Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const admin = await User.create({
      email: 'sf-insuf-admin@example.com',
      password: 'Secret123!',
      fullName: 'SF Insuf Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const student = await User.create({
      email: 'sf-insuf-student@example.com',
      password: 'Secret123!',
      fullName: 'SF Insuf Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacher.id,
        title: 'SF insuf task',
        description: 'Insufficient',
        reward_amount: 40,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const taskId =
      typeof taskInsert[0] === 'number' ? taskInsert[0] : (taskInsert[0] as any).id

    const studentToken = await loginToken(client, student.email)
    const submissionResponse = await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({ taskId, evidenceText: 'SF insuf evidence' })
    const submissionId = (submissionResponse.body() as any).data.id as number

    const teacherToken = await loginToken(client, teacher.email)
    await client
      .patch(`/api/v1/submissions/${submissionId}/teacher-action`)
      .header('authorization', `Bearer ${teacherToken}`)
      .json({ action: 'validate' })
      .then((res) => res.assertStatus(200))

    const adminToken = await loginToken(client, admin.email)
    const approveResponse = await client
      .patch(`/api/v1/submissions/${submissionId}/admin-decision`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({ decision: 'approve' })

    approveResponse.assertStatus(409)
    approveResponse.assertBodyContains({ error: { code: 'INSUFFICIENT_FUNDING_BALANCE' } })

    const submission = await db.from('submissions').where('id', submissionId).first()
    assert.equal(submission.status, 'validated')

    const rewards = await db.from('reward_transactions').where('submission_id', submissionId)
    assert.lengthOf(rewards, 0)
  })

  test('FIFO debits oldest released program first', async ({ client, assert }) => {
    const institutionId = await createInstitution('SF-FIFO')
    const older = await seedReleasedFunding(institutionId, 50, {
      releasedAt: new Date('2026-01-01T10:00:00.000Z'),
    })
    const newer = await seedReleasedFunding(institutionId, 50, {
      releasedAt: new Date('2026-06-01T10:00:00.000Z'),
    })

    const teacher = await User.create({
      email: 'sf-fifo-teacher@example.com',
      password: 'Secret123!',
      fullName: 'SF FIFO Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const admin = await User.create({
      email: 'sf-fifo-admin@example.com',
      password: 'Secret123!',
      fullName: 'SF FIFO Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const student = await User.create({
      email: 'sf-fifo-student@example.com',
      password: 'Secret123!',
      fullName: 'SF FIFO Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacher.id,
        title: 'SF fifo task',
        description: 'FIFO',
        reward_amount: 30,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const taskId =
      typeof taskInsert[0] === 'number' ? taskInsert[0] : (taskInsert[0] as any).id

    const studentToken = await loginToken(client, student.email)
    const submissionResponse = await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({ taskId, evidenceText: 'SF fifo evidence' })
    const submissionId = (submissionResponse.body() as any).data.id as number

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

    const olderRow = await db.from('budget_allocations').where('id', older.allocationId).first()
    const newerRow = await db.from('budget_allocations').where('id', newer.allocationId).first()
    assert.equal(Number(olderRow.utilized_budget), 30)
    assert.equal(Number(newerRow.utilized_budget), 0)

    const reward = await db.from('reward_transactions').where('submission_id', submissionId).first()
    assert.equal(Number(reward.budget_allocation_id), older.allocationId)
  })
})
