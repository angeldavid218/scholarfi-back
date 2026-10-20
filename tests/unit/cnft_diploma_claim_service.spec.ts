import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import StudentDiplomaMint from '#models/student_diploma_mint'
import {
  claimDiplomaForProcessing,
  findEligibleDiplomas,
  markDiplomaSucceeded,
  markDiplomaFailed,
  recoverStaleDiploma,
} from '#services/cnft/cnft_diploma_claim_service'
import env from '#start/env'

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
      email: `student-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
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

test.group('cNFT diploma claim service', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('can claim a pending diploma', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    const row = await StudentDiplomaMint.create({
      institutionId,
      studentId,
      kind: 'outstanding_student',
      rank: 1,
      points: 100,
      displayName: 'Test Student',
      status: 'pending',
      merkleTree: 'test-tree',
      attempts: 0,
    })

    const claimed = await claimDiplomaForProcessing(row.id)
    assert.isNotNull(claimed)
    assert.equal(claimed?.status, 'processing')
    assert.equal(claimed?.attempts, 1)
  })

  test('cannot claim already processing diploma (double-claim rejected)', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    const row = await StudentDiplomaMint.create({
      institutionId,
      studentId,
      kind: 'outstanding_student',
      rank: 1,
      points: 100,
      displayName: 'Test Student',
      status: 'pending',
      merkleTree: 'test-tree',
      attempts: 0,
    })

    const claimed1 = await claimDiplomaForProcessing(row.id)
    assert.isNotNull(claimed1)

    const claimed2 = await claimDiplomaForProcessing(row.id)
    assert.isNull(claimed2)
  })

  test('can reclaim a failed diploma', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    const row = await StudentDiplomaMint.create({
      institutionId,
      studentId,
      kind: 'outstanding_student',
      rank: 1,
      points: 100,
      displayName: 'Test Student',
      status: 'failed',
      merkleTree: 'test-tree',
      attempts: 1,
    })

    const claimed = await claimDiplomaForProcessing(row.id)
    assert.isNotNull(claimed)
    assert.equal(claimed?.attempts, 2)
  })

  test('findEligibleDiplomas respects max attempts', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const institutionId = await createInstitution()
    const studentId1 = await createUser(institutionId)
    const studentId2 = await createUser(institutionId)

    await StudentDiplomaMint.create({
      institutionId,
      studentId: studentId1,
      kind: 'outstanding_student',
      rank: 1,
      points: 100,
      displayName: 'Student 1',
      status: 'pending',
      merkleTree: 'test-tree',
      attempts: 0,
    })

    await StudentDiplomaMint.create({
      institutionId,
      studentId: studentId2,
      kind: 'outstanding_student',
      rank: 2,
      points: 90,
      displayName: 'Student 2',
      status: 'failed',
      merkleTree: 'test-tree',
      attempts: 3,
    })

    const eligible = await findEligibleDiplomas({
      maxAttempts: 3,
      limit: 10,
    })

    assert.lengthOf(eligible, 1)
    assert.equal(eligible[0].studentId, studentId1)
  })

  test('markDiplomaSucceeded updates status', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    const row = await StudentDiplomaMint.create({
      institutionId,
      studentId,
      kind: 'outstanding_student',
      rank: 1,
      points: 100,
      displayName: 'Test Student',
      status: 'processing',
      merkleTree: 'test-tree',
      attempts: 1,
    })

    await markDiplomaSucceeded(row.id, 'asset123', 0, 'sig123')

    await row.refresh()
    assert.equal(row.status, 'confirmed')
    assert.equal(row.assetId, 'asset123')
    assert.equal(row.signature, 'sig123')
  })

  test('markDiplomaFailed updates status', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    const row = await StudentDiplomaMint.create({
      institutionId,
      studentId,
      kind: 'outstanding_student',
      rank: 1,
      points: 100,
      displayName: 'Test Student',
      status: 'processing',
      merkleTree: 'test-tree',
      attempts: 1,
    })

    await markDiplomaFailed(row.id, 'Test error')

    await row.refresh()
    assert.equal(row.status, 'failed')
    assert.equal(row.errorMessage, 'Test error')
  })

  test('recoverStaleDiploma marks confirmed when asset exists', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    const row = await StudentDiplomaMint.create({
      institutionId,
      studentId,
      kind: 'outstanding_student',
      rank: 1,
      points: 100,
      displayName: 'Test Student',
      status: 'processing',
      merkleTree: 'test-tree',
      assetId: 'asset123',
      attempts: 1,
    })

    await recoverStaleDiploma(row.id)

    await row.refresh()
    assert.equal(row.status, 'confirmed')
  })

  test('recoverStaleDiploma marks failed when no asset', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const institutionId = await createInstitution()
    const studentId = await createUser(institutionId)

    const row = await StudentDiplomaMint.create({
      institutionId,
      studentId,
      kind: 'outstanding_student',
      rank: 1,
      points: 100,
      displayName: 'Test Student',
      status: 'processing',
      merkleTree: 'test-tree',
      attempts: 1,
    })

    await recoverStaleDiploma(row.id)

    await row.refresh()
    assert.equal(row.status, 'failed')
    assert.include(row.errorMessage || '', 'no asset ID')
  })
})
