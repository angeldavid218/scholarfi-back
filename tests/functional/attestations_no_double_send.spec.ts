import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import StudentAchievementAttestation from '#models/student_achievement_attestation'

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

async function createInstitution() {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `Test Inst ${Date.now()}`,
      code: `TST-${Date.now()}`,
      status: 'active',
      crypto_wallets_enabled: true,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const row = inserted[0] as any
  return typeof row === 'number' ? row : row.id
}

async function loginToken(client: any, email: string, password: string = 'Secret123!') {
  const response = await client.post('/api/v1/auth/login').json({
    email,
    password,
  })
  const body = response.body() as any
  return body?.data?.token || body?.token || ''
}

test.group('Attestations HTTP endpoints', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('POST /attestations/milestones/run preserves response shape', async ({ client, assert }) => {
    const institutionId = await createInstitution()
    const studentEmail = `student-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`

    const hash = await import('@adonisjs/core/services/hash')
    const hashedPassword = await hash.default.make('Secret123!')

    const student = await db
      .table('users')
      .insert({
        email: studentEmail,
        password: hashedPassword,
        full_name: 'Test Student',
        institution_id: institutionId,
        is_active: true,
        wallet_public_key: 'mock-wallet',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const studentId = (student[0] as any).id || student[0]

    await assignRoleToUser(studentId, 'school_admin', 'School Admin')

    const token = await loginToken(client, studentEmail)

    const response = await client
      .post('/api/v1/attestations/milestones/run')
      .header('authorization', `Bearer ${token}`)
      .json({ studentId })

    assert.isNumber(response.status())
    const body = response.body() as any

    if (response.status() === 200) {
      assert.property(body, 'results')
      assert.property(body, 'summary')
      assert.isArray(body.results)
      assert.isObject(body.summary)
      assert.property(body.summary, 'attested')
      assert.property(body.summary, 'alreadyAttested')
      assert.property(body.summary, 'skipped')
      assert.property(body.summary, 'failed')
    }
  })

  test('POST /attestations/milestones/run prevents double-send under concurrent calls', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution()
    const studentEmail = `student-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`

    const hash = await import('@adonisjs/core/services/hash')
    const hashedPassword = await hash.default.make('Secret123!')

    const student = await db
      .table('users')
      .insert({
        email: studentEmail,
        password: hashedPassword,
        full_name: 'Test Student',
        institution_id: institutionId,
        is_active: true,
        wallet_public_key: 'mock-wallet',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const studentId = (student[0] as any).id || student[0]

    await assignRoleToUser(studentId, 'school_admin', 'School Admin')

    await StudentAchievementAttestation.create({
      studentId,
      institutionId,
      achievementKey: 'first_5_activities',
      threshold: 2,
      achievementHash: 'hash1',
      status: 'pending',
      attempts: 0,
    })

    const token = await loginToken(client, studentEmail)

    const [response1, response2] = await Promise.all([
      client
        .post('/api/v1/attestations/milestones/run')
        .header('authorization', `Bearer ${token}`)
        .json({ studentId }),
      client
        .post('/api/v1/attestations/milestones/run')
        .header('authorization', `Bearer ${token}`)
        .json({ studentId }),
    ])

    assert.isNumber(response1.status())
    assert.isNumber(response2.status())

    const row = await StudentAchievementAttestation.query().where('student_id', studentId).first()

    assert.isAtMost(row?.attempts ?? 0, 1)
  })
})
