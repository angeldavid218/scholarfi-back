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

test.group('Submissions pipeline', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('student can view status with Spanish canonical label', async ({ client, assert }) => {
    const institutionId = await createInstitution('PIPE-STU')
    const teacher = await User.create({
      email: 'pipe-teacher-1@example.com',
      password: 'Secret123!',
      fullName: 'Teacher One',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const student = await User.create({
      email: 'pipe-student-1@example.com',
      password: 'Secret123!',
      fullName: 'Student One',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacher.id,
        title: 'Pipeline task',
        description: 'Pipeline',
        reward_amount: 10,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const task = taskInsert[0] as any
    const taskId = typeof task === 'number' ? task : task.id

    const studentToken = await loginToken(client, student.email)
    const createResponse = await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({
        taskId,
        evidenceText: 'Evidence submitted',
      })
    const submissionId = (createResponse.body() as any).data.id as number

    const detailResponse = await client
      .get(`/api/v1/submissions/${submissionId}`)
      .header('authorization', `Bearer ${studentToken}`)
    detailResponse.assertStatus(200)
    const body = detailResponse.body() as any
    assert.equal(body.data.status, 'pending')
    assert.equal(body.data.statusLabelEs, 'Pendiente de validacion docente')
    assert.deepEqual(body.data.history, [])
  })

  test('student can list own submissions only', async ({ client, assert }) => {
    const institutionId = await createInstitution('PIPE-LST')
    const teacher = await User.create({
      email: 'pipe-teacher-list@example.com',
      password: 'Secret123!',
      fullName: 'Teacher List',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')
    const student = await User.create({
      email: 'pipe-student-list@example.com',
      password: 'Secret123!',
      fullName: 'Student List',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')
    const otherStudent = await User.create({
      email: 'pipe-student-list-other@example.com',
      password: 'Secret123!',
      fullName: 'Student Other',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(otherStudent.id, 'student', 'Student')

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacher.id,
        title: 'List submissions task',
        description: 'List',
        reward_amount: 15,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const task = taskInsert[0] as any
    const taskId = typeof task === 'number' ? task : task.id

    const studentToken = await loginToken(client, student.email)
    await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({ taskId, evidenceText: 'Mine' })

    const otherToken = await loginToken(client, otherStudent.email)
    await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${otherToken}`)
      .json({ taskId, evidenceText: 'Other' })

    const listResponse = await client
      .get('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)

    listResponse.assertStatus(200)
    const body = listResponse.body() as any
    assert.lengthOf(body.data, 1)
    assert.equal(body.data[0].studentId, student.id)
    assert.equal(body.data[0].statusLabelEs, 'Pendiente de validacion docente')
  })

  test('teacher queue is scoped and teacher can validate submission', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution('PIPE-TEA')
    const teacher = await User.create({
      email: 'pipe-teacher-2@example.com',
      password: 'Secret123!',
      fullName: 'Teacher Two',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')
    const otherTeacher = await User.create({
      email: 'pipe-teacher-3@example.com',
      password: 'Secret123!',
      fullName: 'Teacher Three',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(otherTeacher.id, 'teacher', 'Teacher')
    const student = await User.create({
      email: 'pipe-student-2@example.com',
      password: 'Secret123!',
      fullName: 'Student Two',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacher.id,
        title: 'Teacher queue task',
        description: 'Queue',
        reward_amount: 25,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const task = taskInsert[0] as any
    const taskId = typeof task === 'number' ? task : task.id

    const studentToken = await loginToken(client, student.email)
    const createResponse = await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({ taskId, evidenceText: 'Queue evidence' })
    const submissionId = (createResponse.body() as any).data.id as number

    const teacherToken = await loginToken(client, teacher.email)
    const queueResponse = await client
      .get('/api/v1/submissions/teacher-queue')
      .header('authorization', `Bearer ${teacherToken}`)
    queueResponse.assertStatus(200)
    assert.lengthOf((queueResponse.body() as any).data.items, 1)
    assert.equal((queueResponse.body() as any).data.meta.total, 1)

    const otherToken = await loginToken(client, otherTeacher.email)
    const otherQueueResponse = await client
      .get('/api/v1/submissions/teacher-queue')
      .header('authorization', `Bearer ${otherToken}`)
    otherQueueResponse.assertStatus(200)
    assert.lengthOf((otherQueueResponse.body() as any).data.items, 0)

    const validateResponse = await client
      .patch(`/api/v1/submissions/${submissionId}/teacher-action`)
      .header('authorization', `Bearer ${teacherToken}`)
      .json({ action: 'validate' })
    validateResponse.assertStatus(200)
    assert.equal((validateResponse.body() as any).data.status, 'validated')
  })

  test('admin queue and decision enforce valid transitions', async ({ client, assert }) => {
    const institutionId = await createInstitution('PIPE-ADM')
    const teacher = await User.create({
      email: 'pipe-teacher-4@example.com',
      password: 'Secret123!',
      fullName: 'Teacher Four',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')
    const admin = await User.create({
      email: 'pipe-admin-1@example.com',
      password: 'Secret123!',
      fullName: 'Admin One',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')
    const student = await User.create({
      email: 'pipe-student-3@example.com',
      password: 'Secret123!',
      fullName: 'Student Three',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacher.id,
        title: 'Admin queue task',
        description: 'Admin',
        reward_amount: 40,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const task = taskInsert[0] as any
    const taskId = typeof task === 'number' ? task : task.id

    const studentToken = await loginToken(client, student.email)
    const submissionResponse = await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({ taskId, evidenceText: 'Admin evidence' })
    const submissionId = (submissionResponse.body() as any).data.id as number

    const adminToken = await loginToken(client, admin.email)
    const invalidDecision = await client
      .patch(`/api/v1/submissions/${submissionId}/admin-decision`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({ decision: 'approve' })
    invalidDecision.assertStatus(422)
    invalidDecision.assertBodyContains({ error: { code: 'INVALID_STATE_TRANSITION' } })

    const teacherToken = await loginToken(client, teacher.email)
    await client
      .patch(`/api/v1/submissions/${submissionId}/teacher-action`)
      .header('authorization', `Bearer ${teacherToken}`)
      .json({ action: 'validate' })
      .then((res) => res.assertStatus(200))

    const queueResponse = await client
      .get('/api/v1/submissions/admin-queue')
      .header('authorization', `Bearer ${adminToken}`)
    queueResponse.assertStatus(200)
    assert.lengthOf((queueResponse.body() as any).data.items, 1)
    assert.equal((queueResponse.body() as any).data.meta.total, 1)
    assert.equal((queueResponse.body() as any).data.items[0].studentName, 'Student Three')

    const approveResponse = await client
      .patch(`/api/v1/submissions/${submissionId}/admin-decision`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({ decision: 'approve' })
    approveResponse.assertStatus(200)
    assert.equal((approveResponse.body() as any).data.status, 'approved')
    assert.isNumber((approveResponse.body() as any).data.rewardTransactionId)

    const rewardRows = await db.from('token_transactions').where('achievement_id', submissionId)
    assert.lengthOf(rewardRows, 1)
    assert.equal(Number(rewardRows[0].amount), 40)
  })

  test('history is chronological and includes teacher reject reason', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution('PIPE-HIS')
    const teacher = await User.create({
      email: 'pipe-teacher-5@example.com',
      password: 'Secret123!',
      fullName: 'Teacher Five',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')
    const student = await User.create({
      email: 'pipe-student-4@example.com',
      password: 'Secret123!',
      fullName: 'Student Four',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacher.id,
        title: 'Reject task',
        description: 'Reject path',
        reward_amount: 50,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const task = taskInsert[0] as any
    const taskId = typeof task === 'number' ? task : task.id

    const studentToken = await loginToken(client, student.email)
    const createResponse = await client
      .post('/api/v1/submissions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({ taskId, evidenceText: 'Needs feedback' })
    const submissionId = (createResponse.body() as any).data.id as number

    const teacherToken = await loginToken(client, teacher.email)
    const rejectResponse = await client
      .patch(`/api/v1/submissions/${submissionId}/teacher-reject`)
      .header('authorization', `Bearer ${teacherToken}`)
      .json({ reason: 'Evidence does not match required format' })
    rejectResponse.assertStatus(200)
    assert.equal((rejectResponse.body() as any).data.status, 'rejected_by_teacher')

    const detailResponse = await client
      .get(`/api/v1/submissions/${submissionId}`)
      .header('authorization', `Bearer ${studentToken}`)
    detailResponse.assertStatus(200)
    const history = ((detailResponse.body() as any).data.history ?? []) as any[]
    assert.lengthOf(history, 1)
    assert.equal(history[0].action, 'reject')
    assert.equal(history[0].comment, 'Evidence does not match required format')
    assert.equal(history[0].actorRole, 'teacher')
  })
})
