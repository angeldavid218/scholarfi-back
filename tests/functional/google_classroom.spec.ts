import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { ensureMockTeacherIntegration } from '#services/integrations/google_classroom/oauth_service'
import { seedInstitutionCredits } from '../helpers/institution_credits.js'
import { test } from '@japa/runner'

async function ensureRole(roleKey: string, roleLabel: string) {
  // Check if role exists first
  const existingRole = await db.from('roles').where('key', roleKey).first()
  if (existingRole) return existingRole.id as number

  // Use INSERT ... ON CONFLICT to handle race conditions without transaction abort
  // Note: This uses PostgreSQL-specific syntax
  const result = await db.raw(
    `INSERT INTO roles (key, label, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key
     RETURNING id`,
    [roleKey, roleLabel, new Date(), null]
  )

  // Access the result rows (type assertion needed for Knex raw queries)
  const rows = (result as any).rows
  if (rows && rows.length > 0) {
    const created = rows[0] as { id: number }
    return created.id
  }

  throw new Error(`Failed to create or fetch role ${roleKey}`)
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
  const created = inserted[0] as { id: number } | number
  return typeof created === 'number' ? created : created.id
}

async function awaitClassroomSyncResult(client: any, token: string, taskId: number) {
  const syncResponse = await client
    .post(`/api/v1/tasks/${taskId}/sync-classroom`)
    .header('Authorization', `Bearer ${token}`)

  syncResponse.assertStatus(202)
  const enqueueBody = syncResponse.body() as any
  const runId = enqueueBody.data.runId as number

  const runResponse = await client
    .get(`/api/v1/classroom-sync-runs/${runId}`)
    .header('Authorization', `Bearer ${token}`)

  runResponse.assertStatus(200)
  const runBody = runResponse.body() as any
  return {
    enqueue: enqueueBody.data as {
      runId: number
      taskId: number
      status: string
      deduped: boolean
    },
    run: runBody.data as {
      runId: number
      taskId: number
      status: string
      result: any
      errorMessage: string | null
    },
  }
}

async function loginToken(client: any, email: string) {
  const response = await client.post('/api/v1/auth/login').json({
    email,
    password: 'Secret123!',
  })
  return (response.body() as any).data.token as string
}

async function connectMockClassroom(teacherId: number, institutionId: number) {
  await ensureMockTeacherIntegration(teacherId, institutionId)
}

test.group('Google Classroom connector', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('teacher can view connection status and list mock courses', async ({ client, assert }) => {
    const institutionId = await createInstitution('GC-STATUS')
    const teacher = await User.create({
      email: 'gc-teacher@example.com',
      password: 'Secret123!',
      fullName: 'GC Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')
    await connectMockClassroom(teacher.id, institutionId)

    const token = await loginToken(client, teacher.email)
    const statusResponse = await client
      .get('/api/v1/integrations/google-classroom/status')
      .header('Authorization', `Bearer ${token}`)

    statusResponse.assertStatus(200)
    const statusBody = statusResponse.body() as any
    assert.isTrue(statusBody.data.connected)
    assert.isTrue(statusBody.data.mockMode)
    assert.equal(statusBody.data.externalEmail, 'demo.teacher@scholarfi.test')

    const coursesResponse = await client
      .get('/api/v1/integrations/google-classroom/courses')
      .header('Authorization', `Bearer ${token}`)

    coursesResponse.assertStatus(200)
    const coursesBody = coursesResponse.body() as any
    assert.isAbove(coursesBody.data.length, 0)
  })

  test('mock connect upserts integration without Google OAuth', async ({ client, assert }) => {
    const institutionId = await createInstitution('GC-MOCK-CONNECT')
    const teacher = await User.create({
      email: 'gc-mock-connect@example.com',
      password: 'Secret123!',
      fullName: 'GC Mock Connect Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const token = await loginToken(client, teacher.email)
    const connectResponse = await client
      .post('/api/v1/integrations/google-classroom/connect')
      .header('Authorization', `Bearer ${token}`)

    connectResponse.assertStatus(200)
    const connectBody = connectResponse.body() as any
    assert.isNull(connectBody.data.authUrl)
    assert.isTrue(connectBody.data.connected)
    assert.isTrue(connectBody.data.mockMode)

    const statusResponse = await client
      .get('/api/v1/integrations/google-classroom/status')
      .header('Authorization', `Bearer ${token}`)
    statusResponse.assertStatus(200)
    const statusBody = statusResponse.body() as any
    assert.isTrue(statusBody.data.connected)
    assert.equal(statusBody.data.externalEmail, 'demo.teacher@scholarfi.test')

    const coursesResponse = await client
      .get('/api/v1/integrations/google-classroom/courses')
      .header('Authorization', `Bearer ${token}`)
    coursesResponse.assertStatus(200)
    const coursesBody = coursesResponse.body() as any
    assert.isAbove(coursesBody.data.length, 0)
  })

  test('teacher can import classroom task and sync rewards in FIFO order until budget exhausted', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution('GC-SYNC')
    await seedInstitutionCredits(institutionId, 1000)

    const teacher = await User.create({
      email: 'gc-sync-teacher@example.com',
      password: 'Secret123!',
      fullName: 'GC Sync Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const students = await Promise.all(
      [
        { email: 'valentina.rojas@school.edu', name: 'Valentina' },
        { email: 'sofia.hernandez@scholarfi.test', name: 'Sofia' },
      ].map(async (s) => {
        const student = await User.create({
          email: s.email,
          password: 'Secret123!',
          fullName: s.name,
          institutionId,
          isActive: true,
        })
        await assignRoleToUser(student.id, 'student', 'Student')
        return student
      })
    )

    await db.table('teacher_credit_pools').insert({
      institution_id: institutionId,
      teacher_id: teacher.id,
      allocated_credits: 15,
      utilized_credits: 0,
      created_at: new Date(),
      updated_at: null,
    })

    await connectMockClassroom(teacher.id, institutionId)
    const token = await loginToken(client, teacher.email)

    const importResponse = await client
      .post('/api/v1/tasks/from-classroom')
      .header('Authorization', `Bearer ${token}`)
      .json({
        courseId: 'gc-course-1',
        courseWorkId: 'gc-work-1',
        courseName: 'Matematicas 3A',
        section: '3A',
        title: 'Ecuaciones lineales',
        description: 'Resolver ejercicios del capitulo 4',
        rewardAmount: 10,
        minGrade: 6,
        maxPoints: 10,
      })

    importResponse.assertStatus(200)
    const taskId = (importResponse.body() as any).data.id as number

    const baseTime = new Date('2026-07-01T10:00:00.000Z')
    for (const [index, student] of students.entries()) {
      await db.table('submissions').insert({
        institution_id: institutionId,
        task_id: taskId,
        student_id: student.id,
        evidence_text: `Entrega ${student.fullName}`,
        evidence_url: null,
        status: 'pending',
        submitted_at: new Date(baseTime.getTime() + index * 60_000),
        created_at: new Date(),
        updated_at: null,
      })
    }

    const { run: syncRun } = await awaitClassroomSyncResult(client, token, taskId)
    assert.equal(syncRun.status, 'completed')
    assert.equal(syncRun.result.rewarded, 1)
    assert.equal(syncRun.result.skippedBudgetExhausted, 1)
    assert.equal(syncRun.result.budgetRemaining, 5)

    const rewardedSubmission = await db
      .from('submissions')
      .innerJoin('users', 'users.id', 'submissions.student_id')
      .where('submissions.task_id', taskId)
      .andWhere('submissions.status', 'approved')
      .select('users.email as email')
      .first()

    assert.equal(rewardedSubmission?.email, 'valentina.rojas@school.edu')

    const { run: resyncRun } = await awaitClassroomSyncResult(client, token, taskId)
    assert.equal(resyncRun.status, 'completed')
    assert.equal(resyncRun.result.rewarded, 0)
    assert.equal(resyncRun.result.skippedAlreadyRewarded, 1)
  })

  test('mock sync rewards roster students imported via CSV without manual ScholarFi submissions', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution('GC-CSV-ROSTER')
    await seedInstitutionCredits(institutionId, 1000)

    const teacher = await User.create({
      email: 'gc-csv-roster-teacher@example.com',
      password: 'Secret123!',
      fullName: 'GC CSV Roster Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const students = await Promise.all(
      [
        { email: 'valentina.rojas@school.edu', name: 'Valentina' },
        { email: 'sofia.hernandez@scholarfi.test', name: 'Sofia' },
      ].map(async (s) => {
        const student = await User.create({
          email: s.email,
          password: 'Secret123!',
          fullName: s.name,
          institutionId,
          isActive: true,
        })
        await assignRoleToUser(student.id, 'student', 'Student')
        return student
      })
    )

    await db.table('teacher_credit_pools').insert({
      institution_id: institutionId,
      teacher_id: teacher.id,
      allocated_credits: 100,
      utilized_credits: 0,
      created_at: new Date(),
      updated_at: null,
    })

    await connectMockClassroom(teacher.id, institutionId)
    const token = await loginToken(client, teacher.email)

    const csv = [
      'student_email,student_name,registration_number,subject,section,class_name',
      ...students.map(
        (student, index) =>
          `${student.email},${student.fullName},MAT-GC-${index + 1},Matematicas 3A,3A,Matematicas 3A`
      ),
    ].join('\n')

    const importCsvResponse = await client
      .post('/api/v1/groups/import-csv')
      .header('Authorization', `Bearer ${token}`)
      .file('file', Buffer.from(csv), { filename: 'classes.csv', contentType: 'text/csv' })

    importCsvResponse.assertStatus(200)

    const importResponse = await client
      .post('/api/v1/tasks/from-classroom')
      .header('Authorization', `Bearer ${token}`)
      .json({
        courseId: 'gc-course-1',
        courseWorkId: 'gc-work-1',
        courseName: 'Matematicas 3A',
        section: '3A',
        title: 'Ecuaciones lineales',
        description: 'Resolver ejercicios del capitulo 4',
        rewardAmount: 10,
        minGrade: 6,
        maxPoints: 10,
      })

    importResponse.assertStatus(200)
    const taskId = (importResponse.body() as any).data.id as number

    const { run: syncRun } = await awaitClassroomSyncResult(client, token, taskId)
    assert.equal(syncRun.status, 'completed')
    assert.equal(syncRun.result.rewarded, 2)
    assert.equal(syncRun.result.skippedLowGrade, 0)
    assert.equal(syncRun.result.skippedNoGrade, 0)

    const rewardedEmails = await db
      .from('submissions')
      .innerJoin('users', 'users.id', 'submissions.student_id')
      .where('submissions.task_id', taskId)
      .andWhere('submissions.status', 'approved')
      .select('users.email as email')

    assert.sameMembers(
      rewardedEmails.map((row) => row.email),
      ['valentina.rojas@school.edu', 'sofia.hernandez@scholarfi.test']
    )
  })

  test('mock sync uses default grade fixtures for real-looking courseWork ids and demo student emails', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution('GC-MOCK-FALLBACK')
    await seedInstitutionCredits(institutionId, 1000)

    const teacher = await User.create({
      email: 'gc-mock-fallback-teacher@example.com',
      password: 'Secret123!',
      fullName: 'GC Mock Fallback Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const student = await User.create({
      email: 'sofia.hernandez@scholarfi.test',
      password: 'Secret123!',
      fullName: 'Sofia Hernandez',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    await db.table('teacher_credit_pools').insert({
      institution_id: institutionId,
      teacher_id: teacher.id,
      allocated_credits: 20,
      utilized_credits: 0,
      created_at: new Date(),
      updated_at: null,
    })

    await connectMockClassroom(teacher.id, institutionId)
    const token = await loginToken(client, teacher.email)

    const importResponse = await client
      .post('/api/v1/tasks/from-classroom')
      .header('Authorization', `Bearer ${token}`)
      .json({
        courseId: '123456789012',
        courseWorkId: '987654321098',
        courseName: 'Tarea real importada',
        title: 'Tarea 1',
        description: 'Imported from real-looking Google id',
        rewardAmount: 10,
        minGrade: 6,
        maxPoints: 100,
      })

    importResponse.assertStatus(200)
    const taskId = (importResponse.body() as any).data.id as number

    await db.table('submissions').insert({
      institution_id: institutionId,
      task_id: taskId,
      student_id: student.id,
      evidence_text: 'Entrega demo student 1',
      evidence_url: null,
      status: 'pending',
      submitted_at: new Date('2026-07-01T10:00:00.000Z'),
      created_at: new Date(),
      updated_at: null,
    })

    const { run: syncRun } = await awaitClassroomSyncResult(client, token, taskId)
    assert.equal(syncRun.status, 'completed')
    assert.equal(syncRun.result.rewarded, 1)
    assert.equal(syncRun.result.budgetRemaining, 10)
  })

  test('enqueue fails when teacher is not connected to Classroom', async ({ client, assert }) => {
    const institutionId = await createInstitution('GC-SYNC-FAIL')
    await seedInstitutionCredits(institutionId, 100)

    const teacher = await User.create({
      email: 'gc-sync-fail-teacher@example.com',
      password: 'Secret123!',
      fullName: 'GC Sync Fail Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    await db.table('teacher_credit_pools').insert({
      institution_id: institutionId,
      teacher_id: teacher.id,
      allocated_credits: 20,
      utilized_credits: 0,
      created_at: new Date(),
      updated_at: null,
    })

    // Connected so import works, then disconnect before sync.
    await connectMockClassroom(teacher.id, institutionId)
    const token = await loginToken(client, teacher.email)

    const importResponse = await client
      .post('/api/v1/tasks/from-classroom')
      .header('Authorization', `Bearer ${token}`)
      .json({
        courseId: 'gc-course-1',
        courseWorkId: 'gc-work-1',
        courseName: 'Matematicas 3A',
        title: 'Ecuaciones lineales',
        description: 'Resolver ejercicios',
        rewardAmount: 10,
        minGrade: 6,
        maxPoints: 10,
      })
    importResponse.assertStatus(200)
    const taskId = (importResponse.body() as any).data.id as number

    await client
      .delete('/api/v1/integrations/google-classroom/disconnect')
      .header('Authorization', `Bearer ${token}`)

    const { run } = await awaitClassroomSyncResult(client, token, taskId)
    assert.equal(run.status, 'failed')
    assert.isNull(run.result)
    assert.match(String(run.errorMessage ?? ''), /not connected/i)
  })

  test('persistClassroomUserIdsFromRoster links google ids by email and skips conflicts', async ({
    assert,
  }) => {
    const { persistClassroomUserIdsFromRoster } =
      await import('#services/integrations/google_classroom/group_link_service')

    const institutionId = await createInstitution('GC-USERID')
    const student = await User.create({
      email: 'scholarfi101@gmail.com',
      password: 'Secret123!',
      fullName: 'Student One',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const other = await User.create({
      email: 'other-student@school.edu',
      password: 'Secret123!',
      fullName: 'Other Student',
      institutionId,
      isActive: true,
      googleClassroomUserId: '105161253921017540580',
    })
    await assignRoleToUser(other.id, 'student', 'Student')

    const first = await persistClassroomUserIdsFromRoster({
      institutionId,
      emailByUserId: new Map([
        ['100800854909300885323', 'scholarfi101@gmail.com'],
        ['105161253921017540580', 'missing@school.edu'],
      ]),
    })

    assert.equal(first.linked, 1)
    assert.equal(first.notFound, 1)
    assert.equal(first.conflicts, 0)
    assert.equal(first.alreadySet, 0)

    await student.refresh()
    assert.equal(student.googleClassroomUserId, '100800854909300885323')

    const second = await persistClassroomUserIdsFromRoster({
      institutionId,
      emailByUserId: new Map([
        ['100800854909300885323', 'scholarfi101@gmail.com'],
        ['105161253921017540580', 'scholarfi101@gmail.com'],
      ]),
    })

    assert.equal(second.alreadySet, 1)
    assert.equal(second.conflicts, 1)
    assert.equal(second.linked, 0)

    await student.refresh()
    assert.equal(student.googleClassroomUserId, '100800854909300885323')
  })

  test('sync students creates active accounts, activates pending, and does not reset active passwords', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution('GC-SYNC-STU')
    const teacher = await User.create({
      email: 'gc-sync-students-teacher@example.com',
      password: 'Secret123!',
      fullName: 'GC Sync Students Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')
    await connectMockClassroom(teacher.id, institutionId)

    const pending = await User.create({
      email: 'sofia.hernandez@scholarfi.test',
      password: 'RandomPendingPass!',
      fullName: 'Sofia Hernandez',
      institutionId,
      isActive: false,
      accountStatus: 'pending',
      registrationNumber: 'MAT-001',
    })
    await assignRoleToUser(pending.id, 'student', 'Student')

    const active = await User.create({
      email: 'valentina.rojas@school.edu',
      password: 'KeepMyPassword9!',
      fullName: 'Valentina Rojas',
      institutionId,
      isActive: true,
      accountStatus: 'active',
      registrationNumber: 'MAT-ALPHA',
    })
    await assignRoleToUser(active.id, 'student', 'Student')

    const token = await loginToken(client, teacher.email)
    const response = await client
      .post('/api/v1/integrations/google-classroom/sync-students')
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)
    const body = response.body() as any
    const summary = body.data

    assert.isAtLeast(summary.courses, 1)
    assert.equal(summary.created, 0)
    assert.isAtLeast(summary.activated, 1)
    assert.isAtLeast(summary.linked, 2)

    await pending.refresh()
    assert.equal(pending.accountStatus, 'active')
    assert.equal(Boolean(pending.isActive), true)

    const pendingLogin = await client.post('/api/v1/auth/login').json({
      email: pending.email,
      password: 'scholarfi-pass',
    })
    pendingLogin.assertStatus(200)

    const activeLoginOld = await client.post('/api/v1/auth/login').json({
      email: active.email,
      password: 'KeepMyPassword9!',
    })
    activeLoginOld.assertStatus(200)

    const mathGroup = await db
      .from('groups')
      .where('institution_id', institutionId)
      .andWhere('external_source', 'google_classroom')
      .andWhere('external_id', 'gc-course-1')
      .first()
    assert.exists(mathGroup)

    const pendingMembership = await db
      .from('group_students')
      .where('group_id', mathGroup!.id)
      .andWhere('student_id', pending.id)
      .first()
    assert.exists(pendingMembership)
  })

  test('sync-all enqueues every active Classroom task and skips closed or manual tasks', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution('GC-SYNC-ALL')
    await seedInstitutionCredits(institutionId, 1000)

    const teacher = await User.create({
      email: 'gc-sync-all-teacher@example.com',
      password: 'Secret123!',
      fullName: 'GC Sync All Teacher',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')
    await db.table('teacher_credit_pools').insert({
      institution_id: institutionId,
      teacher_id: teacher.id,
      allocated_credits: 50,
      utilized_credits: 0,
      created_at: new Date(),
      updated_at: null,
    })
    await connectMockClassroom(teacher.id, institutionId)
    const token = await loginToken(client, teacher.email)

    const activeImport = await client
      .post('/api/v1/tasks/from-classroom')
      .header('Authorization', `Bearer ${token}`)
      .json({
        courseId: 'gc-course-1',
        courseWorkId: 'gc-work-1',
        courseName: 'Matematicas 3A',
        title: 'Activa',
        description: 'Tarea activa de Classroom',
        rewardAmount: 10,
        minGrade: 6,
        maxPoints: 10,
      })
    activeImport.assertStatus(200)
    const activeTaskId = (activeImport.body() as any).data.id as number

    const closedImport = await client
      .post('/api/v1/tasks/from-classroom')
      .header('Authorization', `Bearer ${token}`)
      .json({
        courseId: 'gc-course-1',
        courseWorkId: 'gc-work-2',
        courseName: 'Matematicas 3A',
        title: 'Cerrada',
        description: 'Tarea cerrada de Classroom',
        rewardAmount: 10,
        minGrade: 6,
        maxPoints: 10,
      })
    closedImport.assertStatus(200)
    const closedTaskId = (closedImport.body() as any).data.id as number

    const closeResponse = await client
      .patch(`/api/v1/tasks/${closedTaskId}/close`)
      .header('Authorization', `Bearer ${token}`)
      .json({})
    closeResponse.assertStatus(200)

    const manualResponse = await client
      .post('/api/v1/tasks')
      .header('Authorization', `Bearer ${token}`)
      .json({
        title: 'Tarea manual',
        description: 'No es de Classroom',
        rewardAmount: 5,
      })
    manualResponse.assertStatus(200)

    const response = await client
      .post('/api/v1/integrations/google-classroom/sync-all')
      .header('Authorization', `Bearer ${token}`)
      .json({})

    response.assertStatus(202)
    const body = response.body() as any
    assert.equal(body.data.tasks, 1)
    assert.lengthOf(body.data.runs, 1)
    assert.equal(body.data.runs[0].taskId, activeTaskId)
    assert.notEqual(body.data.runs[0].taskId, closedTaskId)
  })

  test('sync-all with no matching tasks returns 202 and tasks 0', async ({ client, assert }) => {
    const institutionId = await createInstitution('GC-SYNC-ALL-EMPTY')
    const teacher = await User.create({
      email: 'gc-sync-all-empty@example.com',
      password: 'Secret123!',
      fullName: 'GC Sync All Empty',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')
    await connectMockClassroom(teacher.id, institutionId)
    const token = await loginToken(client, teacher.email)

    const response = await client
      .post('/api/v1/integrations/google-classroom/sync-all')
      .header('Authorization', `Bearer ${token}`)
      .json({})

    response.assertStatus(202)
    const body = response.body() as any
    assert.equal(body.data.tasks, 0)
    assert.lengthOf(body.data.runs, 0)
  })

  test('nightly helper enqueues active Classroom tasks for every connected teacher', async ({
    client,
    assert,
  }) => {
    const { enqueueAllClassroomSyncsForConnectedTeachers } =
      await import('#services/integrations/google_classroom/sync_all_service')

    const institutionA = await createInstitution('GC-NIGHT-A')
    const institutionB = await createInstitution('GC-NIGHT-B')
    await seedInstitutionCredits(institutionA, 1000)
    await seedInstitutionCredits(institutionB, 1000)

    const teacherA = await User.create({
      email: 'gc-nightly-a@example.com',
      password: 'Secret123!',
      fullName: 'Nightly A',
      institutionId: institutionA,
      isActive: true,
    })
    const teacherB = await User.create({
      email: 'gc-nightly-b@example.com',
      password: 'Secret123!',
      fullName: 'Nightly B',
      institutionId: institutionB,
      isActive: true,
    })
    await assignRoleToUser(teacherA.id, 'teacher', 'Teacher')
    await assignRoleToUser(teacherB.id, 'teacher', 'Teacher')
    await db.table('teacher_credit_pools').insert({
      institution_id: institutionA,
      teacher_id: teacherA.id,
      allocated_credits: 20,
      utilized_credits: 0,
      created_at: new Date(),
      updated_at: null,
    })
    await db.table('teacher_credit_pools').insert({
      institution_id: institutionB,
      teacher_id: teacherB.id,
      allocated_credits: 20,
      utilized_credits: 0,
      created_at: new Date(),
      updated_at: null,
    })
    await connectMockClassroom(teacherA.id, institutionA)
    await connectMockClassroom(teacherB.id, institutionB)

    const tokenA = await loginToken(client, teacherA.email)
    const tokenB = await loginToken(client, teacherB.email)

    const importA = await client
      .post('/api/v1/tasks/from-classroom')
      .header('Authorization', `Bearer ${tokenA}`)
      .json({
        courseId: 'gc-course-1',
        courseWorkId: 'gc-work-1',
        courseName: 'Curso A',
        title: 'Tarea A',
        description: 'Nightly teacher A',
        rewardAmount: 10,
        minGrade: 6,
        maxPoints: 10,
      })
    importA.assertStatus(200)
    const taskA = (importA.body() as any).data.id as number

    const importB = await client
      .post('/api/v1/tasks/from-classroom')
      .header('Authorization', `Bearer ${tokenB}`)
      .json({
        courseId: 'gc-course-1',
        courseWorkId: 'gc-work-1',
        courseName: 'Curso B',
        title: 'Tarea B',
        description: 'Nightly teacher B',
        rewardAmount: 10,
        minGrade: 6,
        maxPoints: 10,
      })
    importB.assertStatus(200)
    const taskB = (importB.body() as any).data.id as number

    const result = await enqueueAllClassroomSyncsForConnectedTeachers({
      requestId: 'test-nightly-classroom-sync',
    })

    const ourRuns = result.runs.filter((run) => run.taskId === taskA || run.taskId === taskB)
    assert.lengthOf(ourRuns, 2)
    assert.isAtLeast(result.teachers, 2)
    assert.isAtLeast(result.tasks, 2)
  })
})
