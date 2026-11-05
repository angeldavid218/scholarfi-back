import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import StudentDiplomaMint, {
  OUTSTANDING_STUDENT_DIPLOMA_KIND,
  PROGRESS_ACADEMICO_DIPLOMA_KIND,
} from '#models/student_diploma_mint'
import env from '#start/env'

async function createInstitution(): Promise<number> {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `Test Inst ${Date.now()}`,
      code: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: 'active',
      crypto_wallets_enabled: true,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return inserted[0].id
}

async function createUser(institutionId: number): Promise<number> {
  const inserted = await db
    .table('users')
    .insert({
      email: `student-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
      password: 'hashed',
      full_name: 'Dual Diploma Student',
      institution_id: institutionId,
      is_active: true,
      wallet_public_key: 'mock-wallet-key',
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return inserted[0].id
}

test.group('student_diploma_mints unique by kind', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('allows excelencia and progreso for the same student', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    await StudentDiplomaMint.create({
      institutionId,
      studentId,
      kind: OUTSTANDING_STUDENT_DIPLOMA_KIND,
      rank: 1,
      points: 100,
      displayName: 'Dual Diploma Student',
      status: 'confirmed',
      merkleTree: 'test-tree',
      attempts: 1,
    })

    await StudentDiplomaMint.create({
      institutionId,
      studentId,
      kind: PROGRESS_ACADEMICO_DIPLOMA_KIND,
      rank: 0,
      points: 25,
      displayName: 'Dual Diploma Student',
      status: 'pending',
      merkleTree: 'test-tree',
      attempts: 0,
    })

    const rows = await StudentDiplomaMint.query().where({ institutionId, studentId })
    assert.lengthOf(rows, 2)
  })
})
