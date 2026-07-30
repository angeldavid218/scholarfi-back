import Institution from '#models/institution'
import { DEMO_STUDENTS } from '#fixtures/demo_students'
import { buildGroupDisplayName } from '#services/group_upsert_service'
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
    registrationNumber?: string | null
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
      account_status: 'active',
      registration_number: input.registrationNumber ?? null,
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
      teacher_credit_entries,
      teacher_credit_pools,
      token_transactions,
      redemptions,
      catalog_rewards,
      token_balances,
      reward_transactions,
      simulated_balances,
      student_achievement_attestations,
      submission_chain_proofs,
      submission_validations,
      submissions,
      tasks,
      teacher_integrations,
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

export async function seedDemoBaseline(options: { forceReset: boolean }) {
  const { forceReset } = options

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
        cryptoWalletsEnabled: false,
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

    await db.table('teacher_credit_pools').useTransaction(trx).insert({
      institution_id: institution.id,
      teacher_id: teacherId,
      allocated_credits: 5_000,
      utilized_credits: 0,
      created_at: ts(1).toJSDate(),
      updated_at: ts(1).toJSDate(),
    })

    await db.table('institution_credit_entries').useTransaction(trx).insert({
      institution_id: institution.id,
      entry_type: 'teacher_delegate',
      amount: 5_000,
      submission_id: null,
      token_transaction_id: null,
      actor_user_id: schoolAdminId,
      notes: 'Demo seed teacher budget',
      created_at: ts(1).toJSDate(),
    })

    await db.table('teacher_credit_entries').useTransaction(trx).insert({
      institution_id: institution.id,
      teacher_id: teacherId,
      entry_type: 'admin_allocate',
      amount: 5_000,
      submission_id: null,
      token_transaction_id: null,
      actor_user_id: schoolAdminId,
      notes: 'Demo seed teacher budget',
      created_at: ts(1).toJSDate(),
    })

    const studentIdsByEmail = new Map<string, number>()
    for (const student of DEMO_STUDENTS) {
      const studentId = await insertUser(trx, {
        email: student.email,
        fullName: student.fullName,
        institutionId: institution.id,
        registrationNumber: student.registrationNumber,
      })
      await assignRole(studentId, studentRole, trx)
      studentIdsByEmail.set(student.email, studentId)
    }

    await db
      .table('teacher_students')
      .useTransaction(trx)
      .insert(
        [...studentIdsByEmail.values()].map((studentId) => ({
          institution_id: institution.id,
          teacher_id: teacherId,
          student_id: studentId,
          created_at: ts(1).toJSDate(),
          updated_at: null,
        }))
      )

    const subjectIdsByName = new Map<string, number>()
    for (const student of DEMO_STUDENTS) {
      for (const group of student.seedGroups) {
        if (subjectIdsByName.has(group.subject)) continue

        const inserted = await trx
          .table('subjects')
          .insert({
            institution_id: institution.id,
            name: group.subject,
            code: null,
            status: 'active',
            created_at: ts(1).toJSDate(),
            updated_at: null,
          })
          .returning('id')

        const subjectId = typeof inserted[0] === 'number' ? inserted[0] : inserted[0].id
        subjectIdsByName.set(group.subject, subjectId)
      }
    }

    const groupIdsByKey = new Map<string, number>()
    for (const student of DEMO_STUDENTS) {
      for (const group of student.seedGroups) {
        const groupKey = `${group.subject}|${group.section}|${group.className ?? ''}`
        if (groupIdsByKey.has(groupKey)) continue

        const inserted = await trx
          .table('groups')
          .insert({
            institution_id: institution.id,
            subject_id: subjectIdsByName.get(group.subject)!,
            name: buildGroupDisplayName(group.subject, group.section, group.className ?? null),
            section: group.section,
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

        const groupId = typeof inserted[0] === 'number' ? inserted[0] : inserted[0].id
        groupIdsByKey.set(groupKey, groupId)
      }
    }

    await trx.table('group_teachers').insert(
      [...groupIdsByKey.values()].map((groupId) => ({
        institution_id: institution.id,
        group_id: groupId,
        teacher_id: teacherId,
        created_at: ts(1).toJSDate(),
        updated_at: null,
      }))
    )

    const groupStudentRows: Array<{
      institution_id: number
      group_id: number
      student_id: number
      created_at: Date
      updated_at: null
    }> = []

    for (const student of DEMO_STUDENTS) {
      const studentId = studentIdsByEmail.get(student.email)!
      for (const group of student.seedGroups) {
        const groupKey = `${group.subject}|${group.section}|${group.className ?? ''}`
        groupStudentRows.push({
          institution_id: institution.id,
          group_id: groupIdsByKey.get(groupKey)!,
          student_id: studentId,
          created_at: ts(1).toJSDate(),
          updated_at: null,
        })
      }
    }

    await trx.table('group_students').insert(groupStudentRows)

    return {
      institutionId: institution.id,
      superAdminId,
      schoolAdminId,
      teacherId,
      studentIds: [...studentIdsByEmail.values()],
    }
  })
}
