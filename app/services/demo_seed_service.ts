import Institution from '#models/institution'
import RewardTransaction from '#models/reward_transaction'
import SimulatedBalance from '#models/simulated_balance'
import Submission from '#models/submission'
import SubmissionValidation from '#models/submission_validation'
import Task from '#models/task'
import { DateTime } from 'luxon'

const BASE_TIME = DateTime.fromISO('2026-01-15T10:00:00.000Z')

function ts(minutesFromBase: number) {
  return BASE_TIME.plus({ minutes: minutesFromBase })
}

async function ensureRole(key: string, label: string, trx: any) {
  const dbModule = await import('@adonisjs/lucid/services/db')
  const db = dbModule.default
  const inserted = await db
    .table('roles')
    .useTransaction(trx)
    .insert({
      key,
      label,
      created_at: ts(0).toJSDate(),
      updated_at: null,
    })
    .onConflict('key')
    .ignore()
    .returning('id')

  if (inserted.length > 0) {
    const row = inserted[0] as any
    return typeof row === 'number' ? row : row.id
  }

  const existing = await db.from('roles').useTransaction(trx).where('key', key).firstOrFail()
  return existing.id as number
}

async function assignRole(userId: number, roleId: number, trx: any) {
  const dbModule = await import('@adonisjs/lucid/services/db')
  const db = dbModule.default
  await db
    .table('user_roles')
    .useTransaction(trx)
    .insert({
      user_id: userId,
      role_id: roleId,
      created_at: ts(0).toJSDate(),
      updated_at: null,
    })
}

async function insertUser(
  trx: any,
  input: {
    email: string
    fullName: string
    institutionId: number
  }
) {
  const dbModule = await import('@adonisjs/lucid/services/db')
  const db = dbModule.default
  const hashModule = await import('@adonisjs/core/services/hash')
  const hash = hashModule.default
  const hashedPassword = await hash.make('DemoPass123!')
  const inserted = await db
    .table('users')
    .useTransaction(trx)
    .insert({
      email: input.email,
      full_name: input.fullName,
      password: hashedPassword,
      institution_id: input.institutionId,
      is_active: true,
      created_at: ts(0).toJSDate(),
      updated_at: null,
    })
    .returning('id')
  const row = inserted[0] as any
  return typeof row === 'number' ? row : row.id
}

async function clearDemoTables() {
  const dbModule = await import('@adonisjs/lucid/services/db')
  const db = dbModule.default
  await db.rawQuery(`
    TRUNCATE TABLE
      auth_access_tokens,
      reward_transactions,
      simulated_balances,
      submission_validations,
      submissions,
      tasks,
      teacher_students,
      user_roles,
      roles,
      users,
      institutions
    RESTART IDENTITY CASCADE
  `)
}

export async function seedDemoBaseline(options: {
  forceReset: boolean
  includeStarterData: boolean
}) {
  const { forceReset, includeStarterData } = options

  if (forceReset) {
    await clearDemoTables()
  } else {
    const dbModule = await import('@adonisjs/lucid/services/db')
    const db = dbModule.default
    const existingInstitution = await db.from('institutions').first()
    if (existingInstitution) {
      throw new Error(
        'Demo seed requires an empty baseline. Run "node ace demo:reset" for deterministic re-seeding.'
      )
    }
  }

  const dbModule = await import('@adonisjs/lucid/services/db')
  const db = dbModule.default
  return db.transaction(async (trx) => {
    const institution = await Institution.create(
      {
        name: 'ScholarFi Demo Academy',
        code: 'SFA-DEMO',
        status: 'active',
        createdBy: null,
      },
      { client: trx }
    )

    const schoolAdminRole = await ensureRole('school_admin', 'School Admin', trx)
    const teacherRole = await ensureRole('teacher', 'Teacher', trx)
    const studentRole = await ensureRole('student', 'Student', trx)

    const schoolAdminId = await insertUser(trx, {
      email: 'demo.admin@scholarfi.test',
      fullName: 'Demo School Admin',
      institutionId: institution.id,
    })
    await assignRole(schoolAdminId, schoolAdminRole, trx)

    const teacherId = await insertUser(trx, {
      email: 'demo.teacher@scholarfi.test',
      fullName: 'Demo Teacher',
      institutionId: institution.id,
    })
    await assignRole(teacherId, teacherRole, trx)

    const studentOneId = await insertUser(trx, {
      email: 'demo.student1@scholarfi.test',
      fullName: 'Demo Student One',
      institutionId: institution.id,
    })
    await assignRole(studentOneId, studentRole, trx)

    const studentTwoId = await insertUser(trx, {
      email: 'demo.student2@scholarfi.test',
      fullName: 'Demo Student Two',
      institutionId: institution.id,
    })
    await assignRole(studentTwoId, studentRole, trx)

    await db
      .table('teacher_students')
      .useTransaction(trx)
      .insert([
        {
          institution_id: institution.id,
          teacher_id: teacherId,
          student_id: studentOneId,
          created_at: ts(1).toJSDate(),
          updated_at: null,
        },
        {
          institution_id: institution.id,
          teacher_id: teacherId,
          student_id: studentTwoId,
          created_at: ts(1).toJSDate(),
          updated_at: null,
        },
      ])

    let task: Task | null = null
    let submission: Submission | null = null

    if (includeStarterData) {
      task = await Task.create(
        {
          institutionId: institution.id,
          createdByTeacherId: teacherId,
          title: 'Completa tu primera evidencia',
          description: 'Entrega evidencia corta para validar el flujo demo',
          rewardAmount: 50,
          dueAt: ts(120),
          status: 'active',
        },
        { client: trx }
      )

      submission = await Submission.create(
        {
          institutionId: institution.id,
          taskId: task.id,
          studentId: studentOneId,
          evidenceText: 'Actividad completada en clase',
          evidenceUrl: 'https://example.org/demo-evidence',
          status: 'approved',
          submittedAt: ts(10),
        },
        { client: trx }
      )

      await SubmissionValidation.create(
        {
          submissionId: submission.id,
          teacherId,
          schoolAdminId: null,
          action: 'validate',
          comment: 'Evidencia validada para demo',
        },
        { client: trx }
      )

      await SubmissionValidation.create(
        {
          submissionId: submission.id,
          teacherId: null,
          schoolAdminId: schoolAdminId,
          action: 'approve',
          comment: 'Aprobada para flujo de recompensa demo',
        },
        { client: trx }
      )

      await RewardTransaction.create(
        {
          institutionId: institution.id,
          submissionId: submission.id,
          studentId: studentOneId,
          amount: task.rewardAmount,
          type: 'credit',
          status: 'posted',
          postedAt: ts(20),
        },
        { client: trx }
      )

      await SimulatedBalance.create(
        {
          institutionId: institution.id,
          studentId: studentOneId,
          balance: task.rewardAmount,
        },
        { client: trx }
      )
    }

    return {
      institutionId: institution.id,
      schoolAdminId,
      teacherId,
      studentIds: [studentOneId, studentTwoId],
      starterTaskId: task?.id ?? null,
      starterSubmissionId: submission?.id ?? null,
    }
  })
}
