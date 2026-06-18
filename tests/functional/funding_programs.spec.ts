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

const validProgramPayload = {
  name: 'STEM Scholarship Initiative 2026',
  description: 'Scholarships for STEM students',
  totalBudget: 25000,
  allocationType: 'equal',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  status: 'active',
}

test.group('Funding programs', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('ngo_admin with assigned NGO can create a funding program', async ({ client, assert }) => {
    const ngoId = await createNgo(`NGO-FP-${Date.now()}`)
    const ngoAdmin = await User.create({
      email: 'ngo-admin-fp@example.com',
      password: 'Secret123!',
      fullName: 'NGO Admin FP',
      ngoInstitutionId: ngoId,
      isActive: true,
    })
    await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
    const token = await loginToken(client, ngoAdmin.email)

    const response = await client
      .post('/api/v1/funding-programs')
      .header('authorization', `Bearer ${token}`)
      .json(validProgramPayload)

    response.assertStatus(200)
    const body = response.body() as any
    assert.equal(body.data.name, validProgramPayload.name)
    assert.equal(body.data.totalBudget, validProgramPayload.totalBudget)
    assert.equal(body.data.allocationType, validProgramPayload.allocationType)
    assert.equal(body.data.status, validProgramPayload.status)
    assert.equal(body.data.ngoInstitutionId, ngoId)
    assert.equal(body.data.startDate, validProgramPayload.startDate)
    assert.equal(body.data.endDate, validProgramPayload.endDate)
  })

  test('ngo_admin can list programs scoped to their NGO only', async ({ client, assert }) => {
    const ngoA = await createNgo(`NGO-FP-A-${Date.now()}`)
    const ngoB = await createNgo(`NGO-FP-B-${Date.now()}`)

    await db.table('funding_programs').insert({
      ngo_institution_id: ngoA,
      name: 'Program A',
      description: 'Program for NGO A',
      total_budget: 10000,
      allocation_type: 'equal',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'active',
      created_at: new Date(),
      updated_at: null,
    })
    await db.table('funding_programs').insert({
      ngo_institution_id: ngoB,
      name: 'Program B',
      description: 'Program for NGO B',
      total_budget: 20000,
      allocation_type: 'manual',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'draft',
      created_at: new Date(),
      updated_at: null,
    })

    const ngoAdmin = await User.create({
      email: 'ngo-admin-fp-list@example.com',
      password: 'Secret123!',
      fullName: 'NGO Admin FP List',
      ngoInstitutionId: ngoA,
      isActive: true,
    })
    await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
    const token = await loginToken(client, ngoAdmin.email)

    const response = await client
      .get('/api/v1/funding-programs')
      .header('authorization', `Bearer ${token}`)

    response.assertStatus(200)
    const list = (response.body() as any).data
    assert.lengthOf(list, 1)
    assert.equal(list[0].name, 'Program A')
    assert.equal(list[0].ngoInstitutionId, ngoA)
  })

  test('ngo_admin can show and update own program', async ({ client, assert }) => {
    const ngoId = await createNgo(`NGO-FP-UPD-${Date.now()}`)
    const schoolId = await db
      .table('institutions')
      .insert({
        name: 'Activation School',
        code: `SCH-ACT-${Date.now()}`,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
      .then((rows) => (typeof rows[0] === 'number' ? rows[0] : (rows[0] as any).id))

    const insertProgram = await db
      .table('funding_programs')
      .insert({
        ngo_institution_id: ngoId,
        name: 'Original Program',
        description: 'Original description',
        total_budget: 5000,
        allocation_type: 'equal',
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        status: 'draft',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const programId =
      typeof insertProgram[0] === 'number' ? insertProgram[0] : (insertProgram[0] as any).id

    const ngoAdmin = await User.create({
      email: 'ngo-admin-fp-upd@example.com',
      password: 'Secret123!',
      fullName: 'NGO Admin FP Update',
      ngoInstitutionId: ngoId,
      isActive: true,
    })
    await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
    const token = await loginToken(client, ngoAdmin.email)

    const showResponse = await client
      .get(`/api/v1/funding-programs/${programId}`)
      .header('authorization', `Bearer ${token}`)
    showResponse.assertStatus(200)
    assert.equal((showResponse.body() as any).data.name, 'Original Program')

    await db.table('budget_allocations').insert({
      funding_program_id: programId,
      institution_id: schoolId,
      allocated_budget: 5000,
      utilized_budget: 0,
      status: 'active',
      released_at: null,
      created_at: new Date(),
      updated_at: null,
    })

    const updateResponse = await client
      .patch(`/api/v1/funding-programs/${programId}`)
      .header('authorization', `Bearer ${token}`)
      .json({
        name: 'Updated Program',
        status: 'active',
      })
    updateResponse.assertStatus(200)
    const updated = (updateResponse.body() as any).data
    assert.equal(updated.name, 'Updated Program')
    assert.equal(updated.status, 'active')
    assert.equal(updated.totalBudget, 5000)

    const allocation = await db
      .from('budget_allocations')
      .where('funding_program_id', programId)
      .first()
    assert.isNotNull(allocation.released_at)
  })

  test('ngo_admin cannot access another NGO program', async ({ client }) => {
    const ngoA = await createNgo(`NGO-FP-ISO-A-${Date.now()}`)
    const ngoB = await createNgo(`NGO-FP-ISO-B-${Date.now()}`)

    const insertProgram = await db
      .table('funding_programs')
      .insert({
        ngo_institution_id: ngoB,
        name: 'Other NGO Program',
        description: 'Belongs to NGO B',
        total_budget: 8000,
        allocation_type: 'equal',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const programId =
      typeof insertProgram[0] === 'number' ? insertProgram[0] : (insertProgram[0] as any).id

    const ngoAdmin = await User.create({
      email: 'ngo-admin-fp-iso@example.com',
      password: 'Secret123!',
      fullName: 'NGO Admin FP Isolation',
      ngoInstitutionId: ngoA,
      isActive: true,
    })
    await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
    const token = await loginToken(client, ngoAdmin.email)

    const showResponse = await client
      .get(`/api/v1/funding-programs/${programId}`)
      .header('authorization', `Bearer ${token}`)
    showResponse.assertStatus(404)
    showResponse.assertBodyContains({ error: { code: 'FUNDING_PROGRAM_NOT_FOUND' } })

    const updateResponse = await client
      .patch(`/api/v1/funding-programs/${programId}`)
      .header('authorization', `Bearer ${token}`)
      .json({ name: 'Should not update' })
    updateResponse.assertStatus(404)
    updateResponse.assertBodyContains({ error: { code: 'FUNDING_PROGRAM_NOT_FOUND' } })
  })

  test('non ngo_admin roles are forbidden to create funding programs', async ({ client }) => {
    const teacher = await User.create({
      email: 'teacher-fp@example.com',
      password: 'Secret123!',
      fullName: 'Teacher FP',
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')
    const teacherToken = await loginToken(client, teacher.email)

    const teacherResponse = await client
      .post('/api/v1/funding-programs')
      .header('authorization', `Bearer ${teacherToken}`)
      .json(validProgramPayload)
    teacherResponse.assertStatus(403)
    teacherResponse.assertBodyContains({ error: { code: 'FORBIDDEN_ROLE' } })

    const superAdmin = await User.create({
      email: 'super-admin-fp@example.com',
      password: 'Secret123!',
      fullName: 'Super Admin FP',
      isActive: true,
    })
    await assignRoleToUser(superAdmin.id, 'super_admin', 'Super Admin')
    const superToken = await loginToken(client, superAdmin.email)

    const superResponse = await client
      .post('/api/v1/funding-programs')
      .header('authorization', `Bearer ${superToken}`)
      .json(validProgramPayload)
    superResponse.assertStatus(403)
    superResponse.assertBodyContains({ error: { code: 'FORBIDDEN_ROLE' } })
  })

  test('ngo_admin without ngoInstitutionId gets NGO_SCOPE_REQUIRED', async ({ client }) => {
    const ngoAdmin = await User.create({
      email: 'ngo-admin-no-scope@example.com',
      password: 'Secret123!',
      fullName: 'NGO Admin No Scope',
      isActive: true,
    })
    await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
    const token = await loginToken(client, ngoAdmin.email)

    const response = await client
      .post('/api/v1/funding-programs')
      .header('authorization', `Bearer ${token}`)
      .json(validProgramPayload)

    response.assertStatus(403)
    response.assertBodyContains({ error: { code: 'NGO_SCOPE_REQUIRED' } })
  })

  test('invalid date range returns INVALID_DATE_RANGE', async ({ client }) => {
    const ngoId = await createNgo(`NGO-FP-DATE-${Date.now()}`)
    const ngoAdmin = await User.create({
      email: 'ngo-admin-fp-date@example.com',
      password: 'Secret123!',
      fullName: 'NGO Admin FP Date',
      ngoInstitutionId: ngoId,
      isActive: true,
    })
    await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
    const token = await loginToken(client, ngoAdmin.email)

    const response = await client
      .post('/api/v1/funding-programs')
      .header('authorization', `Bearer ${token}`)
      .json({
        ...validProgramPayload,
        startDate: '2026-12-31',
        endDate: '2026-01-01',
      })

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'INVALID_DATE_RANGE' } })
  })

  test('inactive NGO cannot create funding programs', async ({ client }) => {
    const ngoId = await createNgo(`NGO-FP-INACT-${Date.now()}`, false)
    const ngoAdmin = await User.create({
      email: 'ngo-admin-fp-inact@example.com',
      password: 'Secret123!',
      fullName: 'NGO Admin FP Inactive',
      ngoInstitutionId: ngoId,
      isActive: true,
    })
    await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
    const token = await loginToken(client, ngoAdmin.email)

    const response = await client
      .post('/api/v1/funding-programs')
      .header('authorization', `Bearer ${token}`)
      .json(validProgramPayload)

    response.assertStatus(403)
    response.assertBodyContains({ error: { code: 'NGO_INSTITUTION_INACTIVE' } })
  })

  test('completed funding programs cannot be edited', async ({ client }) => {
    const ngoId = await createNgo(`NGO-FP-COMP-${Date.now()}`)
    const insertProgram = await db
      .table('funding_programs')
      .insert({
        ngo_institution_id: ngoId,
        name: 'Completed Program',
        description: 'Already completed',
        total_budget: 3000,
        allocation_type: 'manual',
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        status: 'completed',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const programId =
      typeof insertProgram[0] === 'number' ? insertProgram[0] : (insertProgram[0] as any).id

    const ngoAdmin = await User.create({
      email: 'ngo-admin-fp-comp@example.com',
      password: 'Secret123!',
      fullName: 'NGO Admin FP Completed',
      ngoInstitutionId: ngoId,
      isActive: true,
    })
    await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
    const token = await loginToken(client, ngoAdmin.email)

    const response = await client
      .patch(`/api/v1/funding-programs/${programId}`)
      .header('authorization', `Bearer ${token}`)
      .json({ name: 'Should not update' })

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'FUNDING_PROGRAM_COMPLETED' } })
  })
})
