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

test.group('NGO flow and dashboard', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('Super Admin can manage NGO institutions and codes must be unique', async ({
    client,
    assert,
  }) => {
    // 1. Create a Super Admin
    const superAdmin = await User.create({
      email: 'super-admin-ngo@example.com',
      password: 'Secret123!',
      fullName: 'Super Admin NGO',
      isActive: true,
    })
    await assignRoleToUser(superAdmin.id, 'super_admin', 'Super Admin')
    const token = await loginToken(client, superAdmin.email)

    // 2. Create NGO Institution
    const code = `NGO-${Date.now()}`
    const storeResponse = await client
      .post('/api/v1/ngo-institutions')
      .header('authorization', `Bearer ${token}`)
      .json({
        name: 'NGO Test',
        code,
        status: true,
      })

    storeResponse.assertStatus(200)
    const storeBody = storeResponse.body() as any
    assert.equal(storeBody.data.name, 'NGO Test')
    assert.equal(storeBody.data.code, code)
    assert.equal(storeBody.data.status, true)
    const ngoId = storeBody.data.id

    // 3. Duplicate code check should return 409 and NGO_INSTITUTION_CODE_TAKEN
    const dupResponse = await client
      .post('/api/v1/ngo-institutions')
      .header('authorization', `Bearer ${token}`)
      .json({
        name: 'NGO Another',
        code,
        status: true,
      })
    dupResponse.assertStatus(409)
    dupResponse.assertBodyContains({
      error: {
        code: 'NGO_INSTITUTION_CODE_TAKEN',
      },
    })

    // 4. Update status
    const statusResponse = await client
      .patch(`/api/v1/ngo-institutions/${ngoId}/status`)
      .header('authorization', `Bearer ${token}`)
      .json({
        status: false,
      })
    statusResponse.assertStatus(200)
    assert.equal((statusResponse.body() as any).data.status, false)

    // 5. Index list
    const indexResponse = await client
      .get('/api/v1/ngo-institutions')
      .header('authorization', `Bearer ${token}`)
    indexResponse.assertStatus(200)
    const list = (indexResponse.body() as any).data
    assert.isAbove(list.length, 0)
    assert.equal(list[0].id, ngoId)
  })

  test('Super Admin can bootstrap and assign NGO Admins', async ({ client, assert }) => {
    // 1. Create Super Admin and NGO
    const superAdmin = await User.create({
      email: 'super-admin-ngo-2@example.com',
      password: 'Secret123!',
      fullName: 'Super Admin NGO 2',
      isActive: true,
    })
    await assignRoleToUser(superAdmin.id, 'super_admin', 'Super Admin')
    const token = await loginToken(client, superAdmin.email)

    const insertNgo = await db
      .table('ngo_institutions')
      .insert({
        name: 'NGO Bootstrap',
        code: 'NGO-BOOT',
        status: true,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const ngoId = typeof insertNgo[0] === 'number' ? insertNgo[0] : (insertNgo[0] as any).id

    // 2. Bootstrap NGO Admin
    const bootstrapResponse = await client
      .post(`/api/v1/ngo-institutions/${ngoId}/bootstrap-ngo-admin`)
      .header('authorization', `Bearer ${token}`)
      .json({
        fullName: 'Bootstrap NGO Admin',
        email: 'ngo-admin-boot@example.com',
        password: 'Secret123!',
      })
    bootstrapResponse.assertStatus(200)
    const bootBody = bootstrapResponse.body() as any
    assert.equal(bootBody.data.role, 'ngo_admin')
    assert.equal(bootBody.data.ngoInstitutionId, ngoId)

    // 3. Assign User (create a user with ngo_admin role and assign)
    const existingUser = await User.create({
      email: 'ngo-admin-assign@example.com',
      password: 'Secret123!',
      fullName: 'Assign NGO Admin',
      isActive: true,
    })
    await assignRoleToUser(existingUser.id, 'ngo_admin', 'NGO Admin')

    const assignResponse = await client
      .patch(`/api/v1/ngo-institutions/${ngoId}/assign-user`)
      .header('authorization', `Bearer ${token}`)
      .json({
        userId: existingUser.id,
      })
    assignResponse.assertStatus(200)
    const assignBody = assignResponse.body() as any
    assert.equal(assignBody.data.userId, existingUser.id)
    assert.equal(assignBody.data.ngoInstitutionId, ngoId)
    assert.equal(assignBody.data.role, 'ngo_admin')
  })

  test('NGO Admin can access consolidated dashboard summary', async ({ client, assert }) => {
    // 1. Setup seed data
    // School Institution
    const schoolInsert = await db
      .table('institutions')
      .insert({
        name: 'School Test',
        code: 'SCH-TEST',
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const schoolId =
      typeof schoolInsert[0] === 'number' ? schoolInsert[0] : (schoolInsert[0] as any).id

    // NGO
    const ngoInsert = await db
      .table('ngo_institutions')
      .insert({
        name: 'NGO Dash',
        code: 'NGO-DASH',
        status: true,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const ngoId = typeof ngoInsert[0] === 'number' ? ngoInsert[0] : (ngoInsert[0] as any).id

    // NGO Admin
    const ngoAdmin = await User.create({
      email: 'ngo-admin-dash@example.com',
      password: 'Secret123!',
      fullName: 'NGO Admin Dashboard',
      ngoInstitutionId: ngoId,
      isActive: true,
    })
    await assignRoleToUser(ngoAdmin.id, 'ngo_admin', 'NGO Admin')
    const ngoToken = await loginToken(client, ngoAdmin.email)

    // Teacher & Student
    const teacher = await User.create({
      email: 'teacher-dash@example.com',
      password: 'Secret123!',
      fullName: 'Teacher Dash',
      institutionId: schoolId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const student = await User.create({
      email: 'student-dash@example.com',
      password: 'Secret123!',
      fullName: 'Student Dash',
      institutionId: schoolId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    // Tasks: 3 separate tasks
    const task1 = await db
      .table('tasks')
      .insert({
        institution_id: schoolId,
        created_by_teacher_id: teacher.id,
        title: 'Task 1',
        description: 'Approved submission task',
        reward_amount: 100,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const taskId1 = typeof task1[0] === 'number' ? task1[0] : (task1[0] as any).id

    const task2 = await db
      .table('tasks')
      .insert({
        institution_id: schoolId,
        created_by_teacher_id: teacher.id,
        title: 'Task 2',
        description: 'Validated submission task',
        reward_amount: 50,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const taskId2 = typeof task2[0] === 'number' ? task2[0] : (task2[0] as any).id

    const task3 = await db
      .table('tasks')
      .insert({
        institution_id: schoolId,
        created_by_teacher_id: teacher.id,
        title: 'Task 3',
        description: 'Pending submission task',
        reward_amount: 25,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const taskId3 = typeof task3[0] === 'number' ? task3[0] : (task3[0] as any).id

    // Submissions: 1 approved, 1 validated, 1 pending (on separate tasks)
    const subApprovedInsert = await db
      .table('submissions')
      .insert({
        institution_id: schoolId,
        task_id: taskId1,
        student_id: student.id,
        evidence_text: 'Approved evidence',
        status: 'approved',
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const subApprovedId =
      typeof subApprovedInsert[0] === 'number'
        ? subApprovedInsert[0]
        : (subApprovedInsert[0] as any).id

    await db.table('submissions').insert([
      {
        institution_id: schoolId,
        task_id: taskId2,
        student_id: student.id,
        evidence_text: 'Validated evidence',
        status: 'validated',
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: null,
      },
      {
        institution_id: schoolId,
        task_id: taskId3,
        student_id: student.id,
        evidence_text: 'Pending evidence',
        status: 'pending',
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: null,
      },
    ])

    // Reward Transaction
    await db.table('reward_transactions').insert({
      institution_id: schoolId,
      submission_id: subApprovedId,
      student_id: student.id,
      amount: 100,
      type: 'credit',
      status: 'posted',
      posted_at: new Date(),
      created_at: new Date(),
      updated_at: null,
    })

    // 2. Fetch summary
    const summaryResponse = await client
      .get('/api/v1/dashboard/summary')
      .header('authorization', `Bearer ${ngoToken}`)

    summaryResponse.assertStatus(200)
    const summaryBody = summaryResponse.body() as any
    assert.isAbove(summaryBody.data.totalSchools, 0)
    assert.isAbove(summaryBody.data.totalTeachers, 0)
    assert.isAbove(summaryBody.data.totalStudents, 0)
    assert.equal(summaryBody.data.totalTasksRedeemed, 1)
    assert.equal(summaryBody.data.completedTasks, 1)
    assert.equal(summaryBody.data.validatedTasks, 1)
    assert.equal(summaryBody.data.pendingValidations, 1)
  })

  test('Non NGO Admin roles are forbidden to access summary', async ({ client }) => {
    // Student
    const student = await User.create({
      email: 'student-no-auth@example.com',
      password: 'Secret123!',
      fullName: 'Student No Auth',
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')
    const token = await loginToken(client, student.email)

    const response = await client
      .get('/api/v1/dashboard/summary')
      .header('authorization', `Bearer ${token}`)
    response.assertStatus(403)
  })
})
