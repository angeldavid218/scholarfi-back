import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import StudentDiplomaMint, {
  PROGRESS_ACADEMICO_DIPLOMA_KIND,
} from '#models/student_diploma_mint'
import StudentGradeProgress from '#models/student_grade_progress'
import env from '#start/env'
import { enqueueProgressDiplomas } from '#services/cnft/cnft_progress_enqueue_service'

async function createInstitution(cryptoEnabled = true): Promise<number> {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `Test Inst ${Date.now()}`,
      code: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: 'active',
      crypto_wallets_enabled: cryptoEnabled,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return inserted[0].id
}

async function createUser(institutionId: number, wallet?: string | null): Promise<number> {
  const inserted = await db
    .table('users')
    .insert({
      email: `student-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
      password: 'hashed',
      full_name: 'Improving Student',
      institution_id: institutionId,
      is_active: true,
      wallet_public_key: wallet === undefined ? 'mock-wallet-key' : wallet,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return inserted[0].id
}

test.group('cnft:enqueue-progress command', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('exits cleanly when lock is held', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const { tryAcquireGlobalLock } = await import('#services/cron/global_lock_service')
    const lock = await tryAcquireGlobalLock('cnft:enqueue-progress')

    try {
      const result = await ace.exec('cnft:enqueue-progress', ['--limit=1'])
      assert.equal(result.exitCode, 0)
    } finally {
      await lock.release()
    }
  })

  test('enqueue is idempotent for existing progreso diploma', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const institutionId = await createInstitution(true)
    const studentId = await createUser(institutionId)

    await StudentGradeProgress.create({
      institutionId,
      studentId,
      category: 'improving',
      gradedCount: 4,
      earlyAvg: '40.0000',
      lateAvg: '70.0000',
      delta: '30.0000',
      analyzedAt: DateTime.now(),
    })

    await StudentDiplomaMint.create({
      institutionId,
      studentId,
      kind: PROGRESS_ACADEMICO_DIPLOMA_KIND,
      rank: 0,
      points: 30,
      displayName: 'Improving Student',
      status: 'pending',
      merkleTree: 'test-tree',
      attempts: 0,
    })

    const result = await enqueueProgressDiplomas({ institutionId, limit: 10 })
    assert.equal(result.skippedExisting, 1)
    assert.equal(result.enqueued, 0)

    const count = await StudentDiplomaMint.query()
      .where({ institutionId, studentId, kind: PROGRESS_ACADEMICO_DIPLOMA_KIND })
      .count('* as total')
    assert.equal(Number(count[0].$extras.total), 1)
  })
})
