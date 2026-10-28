import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import StudentAchievementAttestation from '#models/student_achievement_attestation'
import env from '#start/env'

async function createInstitution(): Promise<number> {
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
  return inserted[0].id
}

async function createUser(institutionId: number): Promise<number> {
  const inserted = await db
    .table('users')
    .insert({
      email: `student-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
      password: 'hashed',
      full_name: 'Test Student',
      institution_id: institutionId,
      is_active: true,
      wallet_public_key: 'mock-wallet-key',
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return inserted[0].id
}

test.group('sas:attest-sweep command', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('exits cleanly when lock is held', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg' || env.get('SAS_ENABLED') !== 'true') {
      return
    }

    const { tryAcquireGlobalLock } = await import('#services/cron/global_lock_service')
    const lock = await tryAcquireGlobalLock('sas:attest-sweep')

    try {
      const result = await ace.exec('sas:attest-sweep', ['--limit=1'])
      assert.equal(result.exitCode, 0)
    } finally {
      await lock.release()
    }
  })

  test('respects --limit flag', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg' || env.get('SAS_ENABLED') !== 'true') {
      return
    }

    const institutionId = await createInstitution()
    const studentId1 = await createUser(institutionId)
    const studentId2 = await createUser(institutionId)
    const studentId3 = await createUser(institutionId)

    await StudentAchievementAttestation.createMany([
      {
        studentId: studentId1,
        institutionId,
        achievementKey: 'first_5_activities',
        threshold: 2,
        achievementHash: 'hash1',
        status: 'pending',
        attempts: 0,
      },
      {
        studentId: studentId2,
        institutionId,
        achievementKey: 'first_5_activities',
        threshold: 2,
        achievementHash: 'hash2',
        status: 'pending',
        attempts: 0,
      },
      {
        studentId: studentId3,
        institutionId,
        achievementKey: 'first_5_activities',
        threshold: 2,
        achievementHash: 'hash3',
        status: 'pending',
        attempts: 0,
      },
    ])

    const result = await ace.exec('sas:attest-sweep', ['--limit=2'])
    assert.equal(result.exitCode, 0)

    const processing = await StudentAchievementAttestation.query()
      .whereIn('student_id', [studentId1, studentId2, studentId3])
      .where('status', 'processing')
      .orWhere('status', 'failed')

    assert.isAtMost(processing.length, 2)
  })

  test('skips records with attempts >= max-attempts', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg' || env.get('SAS_ENABLED') !== 'true') {
      return
    }

    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    await StudentAchievementAttestation.create({
      studentId,
      institutionId,
      achievementKey: 'first_5_activities',
      threshold: 2,
      achievementHash: 'hash1',
      status: 'failed',
      attempts: 3,
    })

    const result = await ace.exec('sas:attest-sweep', ['--max-attempts=3', '--limit=10'])
    assert.equal(result.exitCode, 0)

    const row = await StudentAchievementAttestation.query().where('student_id', studentId).first()

    assert.equal(row?.attempts, 3)
  })

  test('accepts delay-ms flag for pacing', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg' || env.get('SAS_ENABLED') !== 'true') {
      return
    }

    const result = await ace.exec('sas:attest-sweep', ['--limit=1', '--delay-ms=0'])
    assert.equal(result.exitCode, 0)
  })
})
