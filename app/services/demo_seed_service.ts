import BudgetAllocation from '#models/budget_allocation'
import FundingProgram from '#models/funding_program'
import Institution from '#models/institution'
import NgoInstitution from '#models/ngo_institution'
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

const DEMO_FUNDING_BUDGET = 50_000

async function insertUser(
  trx: any,
  input: {
    email: string
    fullName: string
    /** `null` for platform-wide roles (e.g. super admin). */
    institutionId: number | null
    ngoInstitutionId?: number | null
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
      institution_id: input.institutionId ?? null,
      ngo_institution_id: input.ngoInstitutionId ?? null,
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
      budget_allocations,
      funding_programs,
      user_roles,
      roles,
      users,
      institutions,
      ngo_institutions
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

    const superAdminRole = await ensureRole('super_admin', 'Super Admin', trx)
    const schoolAdminRole = await ensureRole('school_admin', 'School Admin', trx)
    const teacherRole = await ensureRole('teacher', 'Teacher', trx)
    const studentRole = await ensureRole('student', 'Student', trx)
    const ngoAdminRole = await ensureRole('ngo_admin', 'NGO Admin', trx)

    const ngo = await NgoInstitution.create(
      {
        name: 'ScholarFi Demo Foundation',
        code: 'NGO-DEMO',
        status: true,
      },
      { client: trx }
    )

    const fundingProgram = await FundingProgram.create(
      {
        ngoInstitutionId: ngo.id,
        name: 'Demo Scholarship Program 2026',
        description: 'Presupuesto de demostracion para recompensas estudiantiles en la academia demo.',
        totalBudget: DEMO_FUNDING_BUDGET,
        allocationType: 'manual',
        startDate: DateTime.fromISO('2026-01-01', { zone: 'utc' }),
        endDate: DateTime.fromISO('2026-12-31', { zone: 'utc' }),
        status: 'active',
      },
      { client: trx }
    )

    const schoolFunding = await BudgetAllocation.create(
      {
        fundingProgramId: fundingProgram.id,
        institutionId: institution.id,
        allocatedBudget: DEMO_FUNDING_BUDGET,
        utilizedBudget: 0,
        status: 'active',
        releasedAt: ts(0),
      },
      { client: trx }
    )

    const ngoAdminId = await insertUser(trx, {
      email: 'demo.ngo@scholarfi.test',
      fullName: 'Demo NGO Admin',
      institutionId: null,
      ngoInstitutionId: ngo.id,
    })
    await assignRole(ngoAdminId, ngoAdminRole, trx)

    const superAdminId = await insertUser(trx, {
      email: 'demo.super@scholarfi.test',
      fullName: 'Demo Super Admin',
      institutionId: null,
    })
    await assignRole(superAdminId, superAdminRole, trx)

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

    let starterTask: Task | null = null
    let starterSubmission: Submission | null = null

    if (includeStarterData) {
      const institutionId = institution.id

      // Task 1 — golden path: approved submission + posted reward (student 1).
      starterTask = await Task.create(
        {
          institutionId,
          createdByTeacherId: teacherId,
          title: 'Completa tu primera evidencia',
          description: 'Entrega evidencia corta para validar el flujo demo',
          rewardAmount: 50,
          dueAt: ts(120),
          status: 'active',
        },
        { client: trx }
      )

      starterSubmission = await Submission.create(
        {
          institutionId,
          taskId: starterTask.id,
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
          submissionId: starterSubmission.id,
          teacherId,
          schoolAdminId: null,
          action: 'validate',
          comment: 'Evidencia validada para demo',
        },
        { client: trx }
      )

      await SubmissionValidation.create(
        {
          submissionId: starterSubmission.id,
          teacherId: null,
          schoolAdminId: schoolAdminId,
          action: 'approve',
          comment: 'Aprobada para flujo de recompensa demo',
        },
        { client: trx }
      )

      await RewardTransaction.create(
        {
          institutionId,
          submissionId: starterSubmission.id,
          studentId: studentOneId,
          amount: starterTask.rewardAmount,
          type: 'credit',
          status: 'posted',
          postedAt: ts(20),
          budgetAllocationId: schoolFunding.id,
        },
        { client: trx }
      )

      schoolFunding.utilizedBudget = starterTask.rewardAmount
      schoolFunding.useTransaction(trx)
      await schoolFunding.save()

      await SimulatedBalance.create(
        {
          institutionId,
          studentId: studentOneId,
          balance: starterTask.rewardAmount,
        },
        { client: trx }
      )

      // Task 2 — teacher queue: two pending submissions (same task, both students).
      const taskReflection = await Task.create(
        {
          institutionId,
          createdByTeacherId: teacherId,
          title: 'Reflexion: aprendizajes clave de la semana',
          description:
            'Resume dos ideas nuevas y una pregunta abierta que quieras discutir en el foro.',
          rewardAmount: 25,
          dueAt: ts(3000),
          status: 'active',
        },
        { client: trx }
      )

      await Submission.create(
        {
          institutionId,
          taskId: taskReflection.id,
          studentId: studentOneId,
          evidenceText:
            'Reflexion 1: entendi mejor como se auditan las decisiones y quien valida cada paso.',
          evidenceUrl: null,
          status: 'pending',
          submittedAt: ts(30),
        },
        { client: trx }
      )

      await Submission.create(
        {
          institutionId,
          taskId: taskReflection.id,
          studentId: studentTwoId,
          evidenceText:
            'Reflexion 2: el flujo docente-admin me ayudo a ver el cuello de botella antes de recompensar.',
          evidenceUrl: 'https://example.org/reflection-s2',
          status: 'pending',
          submittedAt: ts(31),
        },
        { client: trx }
      )

      // Task 3 — teacher queue: pending (student 1 only).
      const taskPortfolio = await Task.create(
        {
          institutionId,
          createdByTeacherId: teacherId,
          title: 'Portafolio: evidencia fotografica del proyecto',
          description:
            'Adjunta una foto clara y una nota breve del contexto (aula, equipo, fecha).',
          rewardAmount: 40,
          dueAt: ts(4320),
          status: 'active',
        },
        { client: trx }
      )

      await Submission.create(
        {
          institutionId,
          taskId: taskPortfolio.id,
          studentId: studentOneId,
          evidenceText:
            'Evidencia: foto del tablero Kanban del equipo con tres tareas movidas a "hecho".',
          evidenceUrl: 'https://example.org/portfolio-s1.jpg',
          status: 'pending',
          submittedAt: ts(32),
        },
        { client: trx }
      )

      // Task 4 — teacher queue: pending (student 2 only).
      const taskEssay = await Task.create(
        {
          institutionId,
          createdByTeacherId: teacherId,
          title: 'Ensayo corto (250–300 palabras)',
          description: 'Argumenta con una tesis, dos pruebas y una conclusion de una frase.',
          rewardAmount: 35,
          dueAt: ts(5200),
          status: 'active',
        },
        { client: trx }
      )

      await Submission.create(
        {
          institutionId,
          taskId: taskEssay.id,
          studentId: studentTwoId,
          evidenceText:
            'Ensayo: la trazabilidad reduce friccion entre docentes y administracion porque cada accion queda asociada a un rol y a un estado canonico.',
          evidenceUrl: null,
          status: 'pending',
          submittedAt: ts(33),
        },
        { client: trx }
      )

      // Task 5 — admin queue: teacher-validated, awaiting school admin (both students).
      const taskLab = await Task.create(
        {
          institutionId,
          createdByTeacherId: teacherId,
          title: 'Laboratorio guiado — checklist de calidad',
          description:
            'Completa el checklist en clase y registra cualquier desviacion con una sola oracion.',
          rewardAmount: 60,
          dueAt: ts(6000),
          status: 'active',
        },
        { client: trx }
      )

      const labSubmissionS1 = await Submission.create(
        {
          institutionId,
          taskId: taskLab.id,
          studentId: studentOneId,
          evidenceText:
            'Checklist: normas de evidencia, formato de enlace, y confirmacion de identidad revisadas.',
          evidenceUrl: 'https://example.org/lab-checklist-s1',
          status: 'validated',
          submittedAt: ts(28),
        },
        { client: trx }
      )

      await SubmissionValidation.create(
        {
          submissionId: labSubmissionS1.id,
          teacherId,
          schoolAdminId: null,
          action: 'validate',
          comment: 'Cumple criterios; enviar a administracion para aprobacion final.',
        },
        { client: trx }
      )

      const labSubmissionS2 = await Submission.create(
        {
          institutionId,
          taskId: taskLab.id,
          studentId: studentTwoId,
          evidenceText:
            'Checklist: capturas de pantalla del flujo y nota de tiempo invertido (18 min).',
          evidenceUrl: null,
          status: 'validated',
          submittedAt: ts(29),
        },
        { client: trx }
      )

      await SubmissionValidation.create(
        {
          submissionId: labSubmissionS2.id,
          teacherId,
          schoolAdminId: null,
          action: 'validate',
          comment: 'Listo para decision de administracion escolar.',
        },
        { client: trx }
      )

      // Task 6 — closed (teacher history / no new submissions).
      await Task.create(
        {
          institutionId,
          createdByTeacherId: teacherId,
          title: 'Ciclo anterior — cierre de unidad',
          description: 'Tarea archivada del ciclo pasado; conservada solo como referencia.',
          rewardAmount: 20,
          dueAt: ts(-2000),
          status: 'closed',
        },
        { client: trx }
      )

      // Tasks 7–8 — active, no submissions yet (students see open work immediately).
      await Task.create(
        {
          institutionId,
          createdByTeacherId: teacherId,
          title: 'Reto opcional: lectura complementaria',
          description:
            'Lee el material enlazado por el docente y redacta tres bullets de takeaway.',
          rewardAmount: 15,
          dueAt: ts(8000),
          status: 'active',
        },
        { client: trx }
      )

      await Task.create(
        {
          institutionId,
          createdByTeacherId: teacherId,
          title: 'Mapa conceptual (digital o foto)',
          description: 'Organiza conceptos principales y relaciones; entrega imagen legible.',
          rewardAmount: 45,
          dueAt: ts(9000),
          status: 'active',
        },
        { client: trx }
      )
    }

    return {
      institutionId: institution.id,
      ngoId: ngo.id,
      ngoAdminId,
      fundingProgramId: fundingProgram.id,
      budgetAllocationId: schoolFunding.id,
      schoolFundingBudget: DEMO_FUNDING_BUDGET,
      superAdminId,
      schoolAdminId,
      teacherId,
      studentIds: [studentOneId, studentTwoId],
      starterTaskId: starterTask?.id ?? null,
      starterSubmissionId: starterSubmission?.id ?? null,
    }
  })
}
