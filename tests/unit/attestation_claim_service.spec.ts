import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import StudentAchievementAttestation from '#models/student_achievement_attestation'
import {
  claimAttestationForProcessing,
  findEligibleAttestations,
  markAttestationSucceeded,
  markAttestationFailed,
  findStaleProcessingAttestations,
} from '#services/attestation/milestone_attestation_claim_service'
import { DateTime } from 'luxon'

async function createInstitution(): Promise<number> {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `Test Inst ${Date.now()}`,
      code: `TST-${Date.now()}`,
      status: 'active',
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
      email: `student-${Date.now()}@test.com`,
      password: 'hashed',
      full_name: 'Test Student',
      institution_id: institutionId,
      is_active: true,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return inserted[0].id
}

import env from '#start/env'

test.group('Attestation claim service', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('can claim a pending attestation', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }
    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    const row = await StudentAchievementAttestation.create({
      studentId,
      institutionId,
      achievementKey: 'first_5_activities',
      threshold: 2,
      achievementHash: 'abc123',
      status: 'pending',
      attempts: 0,
    })

    const claimed = await claimAttestationForProcessing(row.id)
    assert.isNotNull(claimed)
    assert.equal(claimed?.status, 'processing')
    assert.equal(claimed?.attempts, 1)
  })

  test('cannot claim already processing attestation', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }
    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    const row = await StudentAchievementAttestation.create({
      studentId,
      institutionId,
      achievementKey: 'first_5_activities',
      threshold: 2,
      achievementHash: 'abc123',
      status: 'pending',
      attempts: 0,
    })

    const claimed1 = await claimAttestationForProcessing(row.id)
    assert.isNotNull(claimed1)

    const claimed2 = await claimAttestationForProcessing(row.id)
    assert.isNull(claimed2)
  })

  test('can reclaim a failed attestation', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }
    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    const row = await StudentAchievementAttestation.create({
      studentId,
      institutionId,
      achievementKey: 'first_5_activities',
      threshold: 2,
      achievementHash: 'abc123',
      status: 'failed',
      attempts: 1,
    })

    const claimed = await claimAttestationForProcessing(row.id)
    assert.isNotNull(claimed)
    assert.equal(claimed?.attempts, 2)
  })

  test('findEligibleAttestations respects max attempts', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }
    const institutionId = await createInstitution()
    const studentId1 = await createUser(institutionId)
    const studentId2 = await createUser(institutionId)

    await StudentAchievementAttestation.create({
      studentId: studentId1,
      institutionId,
      achievementKey: 'first_5_activities',
      threshold: 2,
      achievementHash: 'abc1',
      status: 'pending',
      attempts: 0,
    })

    await StudentAchievementAttestation.create({
      studentId: studentId2,
      institutionId,
      achievementKey: 'first_5_activities',
      threshold: 2,
      achievementHash: 'abc2',
      status: 'failed',
      attempts: 3,
    })

    const eligible = await findEligibleAttestations({
      achievementKey: 'first_5_activities',
      maxAttempts: 3,
      limit: 10,
    })

    assert.lengthOf(eligible, 1)
    assert.equal(eligible[0].studentId, studentId1)
  })

  test('markAttestationSucceeded updates status', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }
    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    const row = await StudentAchievementAttestation.create({
      studentId,
      institutionId,
      achievementKey: 'first_5_activities',
      threshold: 2,
      achievementHash: 'abc123',
      status: 'processing',
      attempts: 1,
    })

    await markAttestationSucceeded(row.id, 'pda123', 'sig123')

    await row.refresh()
    assert.equal(row.status, 'attested')
    assert.equal(row.attestationPda, 'pda123')
    assert.equal(row.attestationSignature, 'sig123')
  })

  test('markAttestationFailed updates status', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }
    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    const row = await StudentAchievementAttestation.create({
      studentId,
      institutionId,
      achievementKey: 'first_5_activities',
      threshold: 2,
      achievementHash: 'abc123',
      status: 'processing',
      attempts: 1,
    })

    await markAttestationFailed(row.id, 'Test error')

    await row.refresh()
    assert.equal(row.status, 'failed')
    assert.equal(row.errorMessage, 'Test error')
  })

  test('findStaleProcessingAttestations finds old records', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }
    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    const row = await StudentAchievementAttestation.create({
      studentId,
      institutionId,
      achievementKey: 'first_5_activities',
      threshold: 2,
      achievementHash: 'abc123',
      status: 'processing',
      attempts: 1,
    })

    await db
      .from('student_achievement_attestations')
      .where('id', row.id)
      .update({
        last_attempt_at: DateTime.now().minus({ minutes: 40 }).toSQL(),
      })

    const stale = await findStaleProcessingAttestations({
      thresholdMinutes: 30,
      limit: 10,
    })

    assert.equal(stale.length, 1)
    assert.equal(stale[0].id, row.id)
  })
})
