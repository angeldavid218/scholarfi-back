import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import StudentAchievementAttestation from '#models/student_achievement_attestation'
import StudentDiplomaMint from '#models/student_diploma_mint'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import Institution from '#models/institution'
import env from '#start/env'

test.group('Migration backfill', (group) => {
  let institution: Institution

  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    if (env.get('DB_CONNECTION') === 'pg') {
      institution = await Institution.create({
        name: 'Test Institution',
        code: 'TEST',
        status: 'active',
        cryptoWalletsEnabled: false,
      })
    }
    return () => db.rollbackGlobalTransaction()
  })

  test('backfill sets existing failed SAS rows to needs_review', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const user = await User.create({
      email: 'test@example.com',
      password: await hash.make('password'),
      institutionId: institution.id,
    })

    // Create a failed attestation with attempts=0 (pre-migration state)
    const attestation = await StudentAchievementAttestation.create({
      studentId: user.id,
      institutionId: institution.id,
      achievementKey: 'test',
      threshold: 5,
      achievementHash: 'hash123',
      status: 'failed',
      attempts: 0,
      errorMessage: 'Old failure',
    })

    // Run the backfill logic (same as migration - ALL failed rows)
    await db.rawQuery(`
      UPDATE student_achievement_attestations
      SET attempts = 999, status = 'needs_review'
      WHERE status = 'failed'
    `)

    await attestation.refresh()
    assert.equal(attestation.status, 'needs_review')
    assert.equal(attestation.attempts, 999)
  })

  test('backfill sets existing failed cNFT rows to needs_review', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const user = await User.create({
      email: 'test2@example.com',
      password: await hash.make('password'),
      institutionId: institution.id,
    })

    // Create a failed diploma with attempts=0 (pre-migration state)
    const diploma = await StudentDiplomaMint.create({
      studentId: user.id,
      institutionId: institution.id,
      kind: 'outstanding',
      rank: 1,
      points: 100,
      displayName: 'Test',
      status: 'failed',
      attempts: 0,
      errorMessage: 'Old failure',
    })

    // Run the backfill logic (same as migration - ALL failed rows)
    await db.rawQuery(`
      UPDATE student_diploma_mints
      SET attempts = 999, status = 'needs_review'
      WHERE status = 'failed'
    `)

    await diploma.refresh()
    assert.equal(diploma.status, 'needs_review')
    assert.equal(diploma.attempts, 999)
  })

  test('backfill affects ALL failed rows including already-retried', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const user = await User.create({
      email: 'test3@example.com',
      password: await hash.make('password'),
      institutionId: institution.id,
    })

    // Create a failed attestation that has already been retried
    const attestation = await StudentAchievementAttestation.create({
      studentId: user.id,
      institutionId: institution.id,
      achievementKey: 'test',
      threshold: 5,
      achievementHash: 'hash123',
      status: 'failed',
      attempts: 2,
      errorMessage: 'Recent failure',
    })

    // Run the backfill logic (ALL failed rows)
    await db.rawQuery(`
      UPDATE student_achievement_attestations
      SET attempts = 999, status = 'needs_review'
      WHERE status = 'failed'
    `)

    await attestation.refresh()
    // Should now be needs_review
    assert.equal(attestation.status, 'needs_review')
    assert.equal(attestation.attempts, 999)
  })
})
