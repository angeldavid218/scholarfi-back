import Institution from '#models/institution'
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
    /** `null` for platform-wide roles (e.g. super admin). */
    institutionId: number | null
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
      institution_credit_entries,
      institution_credit_pools,
      token_transactions,
      redemptions,
      catalog_rewards,
      token_balances,
      reward_transactions,
      simulated_balances,
      submission_validations,
      submissions,
      tasks,
      group_import_runs,
      group_students,
      group_teachers,
      groups,
      subjects,
      teacher_students,
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
        cryptoWalletsEnabled: true,
        createdBy: null,
      },
      { client: trx }
    )

    const superAdminRole = await ensureRole('super_admin', 'Super Admin', trx)
    const schoolAdminRole = await ensureRole('school_admin', 'School Admin', trx)
    const teacherRole = await ensureRole('teacher', 'Teacher', trx)
    const studentRole = await ensureRole('student', 'Student', trx)
    await ensureRole('ngo_admin', 'NGO Admin', trx)

    const superAdminId = await insertUser(trx, {
      email: 'demo.super@scholarfi.test',
      fullName: 'Demo Super Admin',
      institutionId: null,
    })
    await assignRole(superAdminId, superAdminRole, trx)

    await db
      .table('institution_credit_pools')
      .useTransaction(trx)
      .insert({
        institution_id: institution.id,
        allocated_credits: 50_000,
        utilized_credits: 0,
        created_at: ts(0).toJSDate(),
        updated_at: ts(0).toJSDate(),
      })

    await db
      .table('institution_credit_entries')
      .useTransaction(trx)
      .insert({
        institution_id: institution.id,
        entry_type: 'platform_allocate',
        amount: 50_000,
        submission_id: null,
        token_transaction_id: null,
        actor_user_id: superAdminId,
        notes: 'Demo seed allocation',
        created_at: ts(0).toJSDate(),
      })

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

    const mathSubject = await trx
      .table('subjects')
      .insert({
        institution_id: institution.id,
        name: 'Matemáticas',
        code: null,
        status: 'active',
        created_at: ts(1).toJSDate(),
        updated_at: null,
      })
      .returning('id')
    const mathSubjectId = typeof mathSubject[0] === 'number' ? mathSubject[0] : mathSubject[0].id

    const historySubject = await trx
      .table('subjects')
      .insert({
        institution_id: institution.id,
        name: 'Historia',
        code: null,
        status: 'active',
        created_at: ts(1).toJSDate(),
        updated_at: null,
      })
      .returning('id')
    const historySubjectId =
      typeof historySubject[0] === 'number' ? historySubject[0] : historySubject[0].id

    const mathGroup = await trx
      .table('groups')
      .insert({
        institution_id: institution.id,
        subject_id: mathSubjectId,
        name: 'Matemáticas 3°A',
        section: '3°A',
        code: null,
        sync_metadata: null,
        status: 'active',
        external_source: 'manual',
        external_id: null,
        created_by_teacher_id: teacherId,
        created_at: ts(1).toJSDate(),
        updated_at: null,
      })
      .returning('id')
    const mathGroupId = typeof mathGroup[0] === 'number' ? mathGroup[0] : mathGroup[0].id

    const historyGroup = await trx
      .table('groups')
      .insert({
        institution_id: institution.id,
        subject_id: historySubjectId,
        name: 'Historia 3°A',
        section: '3°A',
        code: null,
        sync_metadata: null,
        status: 'active',
        external_source: 'manual',
        external_id: null,
        created_by_teacher_id: teacherId,
        created_at: ts(1).toJSDate(),
        updated_at: null,
      })
      .returning('id')
    const historyGroupId = typeof historyGroup[0] === 'number' ? historyGroup[0] : historyGroup[0].id

    await trx.table('group_teachers').insert([
      {
        institution_id: institution.id,
        group_id: mathGroupId,
        teacher_id: teacherId,
        created_at: ts(1).toJSDate(),
        updated_at: null,
      },
      {
        institution_id: institution.id,
        group_id: historyGroupId,
        teacher_id: teacherId,
        created_at: ts(1).toJSDate(),
        updated_at: null,
      },
    ])

    await trx.table('group_students').insert([
      {
        institution_id: institution.id,
        group_id: mathGroupId,
        student_id: studentOneId,
        created_at: ts(1).toJSDate(),
        updated_at: null,
      },
      {
        institution_id: institution.id,
        group_id: mathGroupId,
        student_id: studentTwoId,
        created_at: ts(1).toJSDate(),
        updated_at: null,
      },
      {
        institution_id: institution.id,
        group_id: historyGroupId,
        student_id: studentOneId,
        created_at: ts(1).toJSDate(),
        updated_at: null,
      },
      {
        institution_id: institution.id,
        group_id: historyGroupId,
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

      await trx.table('token_transactions').insert({
        institution_id: institutionId,
        user_id: studentOneId,
        achievement_id: starterSubmission.id,
        redemption_id: null,
        amount: starterTask.rewardAmount,
        type: 'mint',
        status: 'confirmed',
        provider: 'mock',
        transaction_signature: null,
        token_mint: null,
        wallet_public_key: null,
        error_message: null,
        created_at: ts(20).toJSDate(),
        updated_at: ts(20).toJSDate(),
      })

      await trx.table('token_balances').insert({
        user_id: studentOneId,
        balance: starterTask.rewardAmount,
        updated_at: ts(20).toJSDate(),
      })

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
      superAdminId,
      schoolAdminId,
      teacherId,
      studentIds: [studentOneId, studentTwoId],
      starterTaskId: starterTask?.id ?? null,
      starterSubmissionId: starterSubmission?.id ?? null,
    }
  })
}
