import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { encryptIntegrationToken } from '#services/integrations/integration_token_crypto'
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
  const created = inserted[0] as { id: number } | number
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
  const created = inserted[0] as { id: number } | number
  return typeof created === 'number' ? created : created.id
}

async function loginToken(client: any, email: string) {
  const response = await client.post('/api/v1/auth/login').json({
    email,
    password: 'Secret123!',
  })
  return (response.body() as any).data.token as string
}

async function connectMockClassroom(teacherId: number, institutionId: number) {
  await db.table('teacher_integrations').insert({
    teacher_id: teacherId,
    institution_id: institutionId,
    provider: 'google_classroom',
    external_user_id: 'gc-teacher-1',
    external_email: 'teacher@classroom.test',
    encrypted_refresh_token: encryptIntegrationToken('mock-refresh-token'),
    scopes:
      'https://www.googleapis.com/auth/classroom.courses.readonly,https://www.googleapis.com/auth/classroom.coursework.students.readonly',
    connected_at: new Date(),
    last_sync_at: null,
    created_at: new Date(),
    updated_at: null,
  })
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
    assert.equal(statusBody.data.externalEmail, 'teacher@classroom.test')

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
        { email: 'student-alpha@school.edu', name: 'Alpha' },
        { email: 'student-beta@school.edu', name: 'Beta' },
        { email: 'student-gamma@school.edu', name: 'Gamma' },
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

    const syncResponse = await client
      .post(`/api/v1/tasks/${taskId}/sync-classroom`)
      .header('Authorization', `Bearer ${token}`)

    syncResponse.assertStatus(200)
    const syncBody = syncResponse.body() as any
    assert.equal(syncBody.data.rewarded, 1)
    assert.equal(syncBody.data.skippedLowGrade, 1)
    assert.equal(syncBody.data.skippedNoGrade, 1)
    assert.equal(syncBody.data.budgetRemaining, 5)

    const rewardedSubmission = await db
      .from('submissions')
      .innerJoin('users', 'users.id', 'submissions.student_id')
      .where('submissions.task_id', taskId)
      .andWhere('submissions.status', 'approved')
      .select('users.email as email')
      .first()

    assert.equal(rewardedSubmission?.email, 'student-alpha@school.edu')

    const resyncResponse = await client
      .post(`/api/v1/tasks/${taskId}/sync-classroom`)
      .header('Authorization', `Bearer ${token}`)

    resyncResponse.assertStatus(200)
    const resyncBody = resyncResponse.body() as any
    assert.equal(resyncBody.data.rewarded, 0)
    assert.equal(resyncBody.data.skippedAlreadyRewarded, 1)
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
        { email: 'student-alpha@school.edu', name: 'Alpha' },
        { email: 'student-beta@school.edu', name: 'Beta' },
        { email: 'student-gamma@school.edu', name: 'Gamma' },
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

    const syncResponse = await client
      .post(`/api/v1/tasks/${taskId}/sync-classroom`)
      .header('Authorization', `Bearer ${token}`)

    syncResponse.assertStatus(200)
    const syncBody = syncResponse.body() as any
    assert.equal(syncBody.data.rewarded, 1)
    assert.equal(syncBody.data.skippedLowGrade, 1)
    assert.equal(syncBody.data.skippedNoGrade, 1)

    const rewardedSubmission = await db
      .from('submissions')
      .innerJoin('users', 'users.id', 'submissions.student_id')
      .where('submissions.task_id', taskId)
      .andWhere('submissions.status', 'approved')
      .select('users.email as email')
      .first()

    assert.equal(rewardedSubmission?.email, 'student-alpha@school.edu')
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
      email: 'demo.student1@scholarfi.test',
      password: 'Secret123!',
      fullName: 'Demo Student One',
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

    const syncResponse = await client
      .post(`/api/v1/tasks/${taskId}/sync-classroom`)
      .header('Authorization', `Bearer ${token}`)

    syncResponse.assertStatus(200)
    const syncBody = syncResponse.body() as any
    assert.equal(syncBody.data.rewarded, 1)
    assert.equal(syncBody.data.budgetRemaining, 10)
  })

  test('persistClassroomUserIdsFromRoster links google ids by email and skips conflicts', async ({
    assert,
  }) => {
    const { persistClassroomUserIdsFromRoster } = await import(
      '#services/integrations/google_classroom/group_link_service'
    )

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
})
