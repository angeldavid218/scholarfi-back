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

async function loginToken(client: any, email: string) {
  const response = await client.post('/api/v1/auth/login').json({
    email,
    password: 'Secret123!',
  })
  return (response.body() as any).data.token as string
}

async function createNgo(code: string, status = true) {
  const insertNgo = await db
    .table('ngo_institutions')
    .insert({
      name: `NGO ${code}`,
      code,
      status,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return typeof insertNgo[0] === 'number' ? insertNgo[0] : (insertNgo[0] as any).id
}

async function createInstitution(code: string, status = 'active') {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `School ${code}`,
      code,
      status,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return typeof inserted[0] === 'number' ? inserted[0] : (inserted[0] as any).id
}

async function createProgram(
  ngoId: number,
  allocationType: 'equal' | 'manual',
  totalBudget = 25000
) {
  const inserted = await db
    .table('funding_programs')
    .insert({
      ngo_institution_id: ngoId,
      name: `Program ${allocationType}`,
      description: 'Test program',
      total_budget: totalBudget,
      allocation_type: allocationType,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'active',
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return typeof inserted[0] === 'number' ? inserted[0] : (inserted[0] as any).id
}

async function createNgoAdmin(ngoId: number, email: string) {
  const ngoAdmin = await User.create({
    email,
    password: 'Secret123!',
    fullName: 'NGO Admin Budget',
    ngoInstitutionId: ngoId,
    isActive: true,
  })
  await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
  return ngoAdmin
}

test.group('Budget allocations', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('manual program allocations return list summary and traceability fields', async ({
    client,
    assert,
  }) => {
    const ngoId = await createNgo(`NGO-BA-${Date.now()}`)
    const schoolA = await createInstitution(`SCH-A-${Date.now()}`)
    const schoolB = await createInstitution(`SCH-B-${Date.now()}`)
    const programId = await createProgram(ngoId, 'manual')
    const ngoAdmin = await createNgoAdmin(ngoId, 'ngo-admin-ba-manual@example.com')
    const token = await loginToken(client, ngoAdmin.email)

    const storeResponse = await client
      .post(`/api/v1/funding-programs/${programId}/budget-allocations`)
      .header('authorization', `Bearer ${token}`)
      .json({
        allocations: [
          { institutionId: schoolA, allocatedBudget: 10000 },
          { institutionId: schoolB, allocatedBudget: 15000 },
        ],
      })

    storeResponse.assertStatus(200)
    const created = (storeResponse.body() as any).data
    assert.lengthOf(created, 2)
    const budgets = created.map((row: any) => row.allocatedBudget).sort((a: number, b: number) => a - b)
    assert.deepEqual(budgets, [10000, 15000])
    assert.isTrue(created.every((row: any) => row.utilizedBudget === 0))
    assert.isTrue(created.every((row: any) => row.status === 'active'))
    assert.isTrue(created.every((row: any) => row.releasedAt !== null))
    assert.exists(created[0].institutionName)

    const listResponse = await client
      .get(`/api/v1/funding-programs/${programId}/budget-allocations`)
      .header('authorization', `Bearer ${token}`)

    listResponse.assertStatus(200)
    const listBody = listResponse.body() as any
    assert.lengthOf(listBody.data, 2)
    assert.equal(listBody.summary.totalBudget, 25000)
    assert.equal(listBody.summary.totalAllocated, 25000)
    assert.equal(listBody.summary.totalUtilized, 0)
    assert.equal(listBody.summary.remainingToAllocate, 0)
  })

  test('equal program splits remaining budget evenly across schools', async ({ client, assert }) => {
    const ngoId = await createNgo(`NGO-BA-EQ-${Date.now()}`)
    const schoolA = await createInstitution(`SCH-EQ-A-${Date.now()}`)
    const schoolB = await createInstitution(`SCH-EQ-B-${Date.now()}`)
    const schoolC = await createInstitution(`SCH-EQ-C-${Date.now()}`)
    const programId = await createProgram(ngoId, 'equal', 10000)
    const ngoAdmin = await createNgoAdmin(ngoId, 'ngo-admin-ba-equal@example.com')
    const token = await loginToken(client, ngoAdmin.email)

    const storeResponse = await client
      .post(`/api/v1/funding-programs/${programId}/budget-allocations`)
      .header('authorization', `Bearer ${token}`)
      .json({
        institutionIds: [schoolA, schoolB, schoolC],
      })

    storeResponse.assertStatus(200)
    const created = (storeResponse.body() as any).data
    assert.lengthOf(created, 3)
    const amounts = created.map((row: any) => row.allocatedBudget).sort((a: number, b: number) => a - b)
    assert.deepEqual(amounts, [3333, 3333, 3334])
    assert.equal(amounts.reduce((sum: number, value: number) => sum + value, 0), 10000)
  })

  test('allocations exceeding program total return BUDGET_EXCEEDS_PROGRAM_TOTAL', async ({
    client,
  }) => {
    const ngoId = await createNgo(`NGO-BA-CAP-${Date.now()}`)
    const schoolA = await createInstitution(`SCH-CAP-A-${Date.now()}`)
    const schoolB = await createInstitution(`SCH-CAP-B-${Date.now()}`)
    const programId = await createProgram(ngoId, 'manual', 10000)
    const ngoAdmin = await createNgoAdmin(ngoId, 'ngo-admin-ba-cap@example.com')
    const token = await loginToken(client, ngoAdmin.email)

    const response = await client
      .post(`/api/v1/funding-programs/${programId}/budget-allocations`)
      .header('authorization', `Bearer ${token}`)
      .json({
        allocations: [
          { institutionId: schoolA, allocatedBudget: 7000 },
          { institutionId: schoolB, allocatedBudget: 5000 },
        ],
      })

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'BUDGET_EXCEEDS_PROGRAM_TOTAL' } })
  })

  test('duplicate school allocation returns ALLOCATION_ALREADY_EXISTS', async ({ client }) => {
    const ngoId = await createNgo(`NGO-BA-DUP-${Date.now()}`)
    const schoolA = await createInstitution(`SCH-DUP-A-${Date.now()}`)
    const programId = await createProgram(ngoId, 'manual', 10000)
    const ngoAdmin = await createNgoAdmin(ngoId, 'ngo-admin-ba-dup@example.com')
    const token = await loginToken(client, ngoAdmin.email)

    await client
      .post(`/api/v1/funding-programs/${programId}/budget-allocations`)
      .header('authorization', `Bearer ${token}`)
      .json({
        allocations: [{ institutionId: schoolA, allocatedBudget: 3000 }],
      })

    const response = await client
      .post(`/api/v1/funding-programs/${programId}/budget-allocations`)
      .header('authorization', `Bearer ${token}`)
      .json({
        allocations: [{ institutionId: schoolA, allocatedBudget: 2000 }],
      })

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'ALLOCATION_ALREADY_EXISTS' } })
  })

  test('ngo_admin cannot access allocations on another NGO program', async ({ client }) => {
    const ngoA = await createNgo(`NGO-BA-ISO-A-${Date.now()}`)
    const ngoB = await createNgo(`NGO-BA-ISO-B-${Date.now()}`)
    const programB = await createProgram(ngoB, 'manual')
    const ngoAdminA = await createNgoAdmin(ngoA, 'ngo-admin-ba-iso@example.com')
    const token = await loginToken(client, ngoAdminA.email)

    const response = await client
      .get(`/api/v1/funding-programs/${programB}/budget-allocations`)
      .header('authorization', `Bearer ${token}`)

    response.assertStatus(404)
    response.assertBodyContains({ error: { code: 'FUNDING_PROGRAM_NOT_FOUND' } })
  })

  test('patch cannot set allocatedBudget below utilizedBudget', async ({ client }) => {
    const ngoId = await createNgo(`NGO-BA-UTIL-${Date.now()}`)
    const schoolA = await createInstitution(`SCH-UTIL-A-${Date.now()}`)
    const programId = await createProgram(ngoId, 'manual', 10000)
    const ngoAdmin = await createNgoAdmin(ngoId, 'ngo-admin-ba-util@example.com')
    const token = await loginToken(client, ngoAdmin.email)

    const storeResponse = await client
      .post(`/api/v1/funding-programs/${programId}/budget-allocations`)
      .header('authorization', `Bearer ${token}`)
      .json({
        allocations: [{ institutionId: schoolA, allocatedBudget: 5000 }],
      })
    const allocationId = (storeResponse.body() as any).data[0].id

    await db.from('budget_allocations').where('id', allocationId).update({ utilized_budget: 3000 })

    const response = await client
      .patch(`/api/v1/funding-programs/${programId}/budget-allocations/${allocationId}`)
      .header('authorization', `Bearer ${token}`)
      .json({ allocatedBudget: 2000 })

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'ALLOCATED_BELOW_UTILIZED' } })
  })

  test('patch on closed allocation returns BUDGET_ALLOCATION_CLOSED', async ({ client }) => {
    const ngoId = await createNgo(`NGO-BA-CLOSED-${Date.now()}`)
    const schoolA = await createInstitution(`SCH-CLOSED-A-${Date.now()}`)
    const programId = await createProgram(ngoId, 'manual', 10000)
    const ngoAdmin = await createNgoAdmin(ngoId, 'ngo-admin-ba-closed@example.com')
    const token = await loginToken(client, ngoAdmin.email)

    const storeResponse = await client
      .post(`/api/v1/funding-programs/${programId}/budget-allocations`)
      .header('authorization', `Bearer ${token}`)
      .json({
        allocations: [{ institutionId: schoolA, allocatedBudget: 5000 }],
      })
    const allocationId = (storeResponse.body() as any).data[0].id

    await db.from('budget_allocations').where('id', allocationId).update({ status: 'closed' })

    const response = await client
      .patch(`/api/v1/funding-programs/${programId}/budget-allocations/${allocationId}`)
      .header('authorization', `Bearer ${token}`)
      .json({ status: 'active' })

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'BUDGET_ALLOCATION_CLOSED' } })
  })

  test('teacher and unscoped ngo_admin are forbidden', async ({ client }) => {
    const teacher = await User.create({
      email: 'teacher-ba@example.com',
      password: 'Secret123!',
      fullName: 'Teacher BA',
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')
    const teacherToken = await loginToken(client, teacher.email)

    const teacherResponse = await client
      .get('/api/v1/funding-programs/1/budget-allocations')
      .header('authorization', `Bearer ${teacherToken}`)
    teacherResponse.assertStatus(403)
    teacherResponse.assertBodyContains({ error: { code: 'FORBIDDEN_ROLE' } })

    const ngoAdmin = await User.create({
      email: 'ngo-admin-ba-noscope@example.com',
      password: 'Secret123!',
      fullName: 'NGO Admin No Scope BA',
      isActive: true,
    })
    await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
    const ngoToken = await loginToken(client, ngoAdmin.email)

    const ngoResponse = await client
      .get('/api/v1/funding-programs/1/budget-allocations')
      .header('authorization', `Bearer ${ngoToken}`)
    ngoResponse.assertStatus(403)
    ngoResponse.assertBodyContains({ error: { code: 'NGO_SCOPE_REQUIRED' } })
  })

  test('available institutions endpoint returns active schools only', async ({ client, assert }) => {
    const ngoId = await createNgo(`NGO-BA-AVAIL-${Date.now()}`)
    const activeSchool = await createInstitution(`SCH-ACTIVE-${Date.now()}`, 'active')
    await createInstitution(`SCH-DRAFT-${Date.now()}`, 'draft')
    const ngoAdmin = await createNgoAdmin(ngoId, 'ngo-admin-ba-avail@example.com')
    const token = await loginToken(client, ngoAdmin.email)

    const response = await client
      .get('/api/v1/funding-programs/institutions/available')
      .header('authorization', `Bearer ${token}`)

    response.assertStatus(200)
    const list = (response.body() as any).data
    assert.isTrue(list.some((row: any) => row.id === activeSchool))
    assert.isFalse(list.some((row: any) => row.status !== 'active'))
  })
})
