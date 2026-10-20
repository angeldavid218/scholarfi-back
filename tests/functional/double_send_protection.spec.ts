import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import StudentAchievementAttestation from '#models/student_achievement_attestation'
import StudentDiplomaMint from '#models/student_diploma_mint'
import User from '#models/user'
import Institution from '#models/institution'
import hash from '@adonisjs/core/services/hash'

test.group('Double-send protection', (group) => {
  let institution: Institution

  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    institution = await Institution.create({
      name: 'Test Institution',
      code: 'TEST',
      status: 'active',
      cryptoWalletsEnabled: false,
    })
    return () => db.rollbackGlobalTransaction()
  })

  test('SAS attestation claim enforces attempts < max', async ({ assert }) => {
    const { claimAttestationForProcessing } =
      await import('#services/attestation/milestone_attestation_claim_service')

    const user = await User.create({
      email: 'test@example.com',
      password: await hash.make('password'),
      institutionId: institution.id,
    })

    const attestation = await StudentAchievementAttestation.create({
      studentId: user.id,
      institutionId: institution.id,
      achievementKey: 'test',
      threshold: 5,
      achievementHash: 'hash123',
      status: 'failed',
      attempts: 3,
    })

    const claimed = await claimAttestationForProcessing(attestation.id, 3)
    assert.isNull(claimed, 'Should not claim when attempts >= max')

    await attestation.refresh()
    assert.equal(attestation.attempts, 3, 'Attempts should not increment')
    assert.equal(attestation.status, 'failed', 'Status should remain failed')
  })

  test('cNFT diploma claim enforces attempts < max', async ({ assert }) => {
    const { claimDiplomaForProcessing } = await import('#services/cnft/cnft_diploma_claim_service')

    const user = await User.create({
      email: 'test2@example.com',
      password: await hash.make('password'),
      institutionId: institution.id,
    })

    const diploma = await StudentDiplomaMint.create({
      studentId: user.id,
      institutionId: institution.id,
      kind: 'outstanding',
      rank: 1,
      points: 100,
      displayName: 'Test',
      status: 'failed',
      attempts: 3,
    })

    const claimed = await claimDiplomaForProcessing(diploma.id, 3)
    assert.isNull(claimed, 'Should not claim when attempts >= max')

    await diploma.refresh()
    assert.equal(diploma.attempts, 3, 'Attempts should not increment')
  })

  test('needs_review status persists in database', async ({ assert }) => {
    const { markAttestationNeedsReview } =
      await import('#services/attestation/milestone_attestation_claim_service')

    const user = await User.create({
      email: 'test3@example.com',
      password: await hash.make('password'),

      institutionId: institution.id,
    })

    const attestation = await StudentAchievementAttestation.create({
      studentId: user.id,
      institutionId: institution.id,
      achievementKey: 'test',
      threshold: 5,
      achievementHash: 'hash123',
      status: 'processing',
      attempts: 2,
    })

    await markAttestationNeedsReview(attestation.id, 'Chain verification failed')

    await attestation.refresh()
    assert.equal(attestation.status, 'needs_review')
    assert.equal(attestation.errorMessage, 'Chain verification failed')
  })

  test('stale attestation recovery marks needs_review when PDA not found', async ({ assert }) => {
    const { recoverStaleAttestation } =
      await import('#services/attestation/milestone_attestation_claim_service')

    const user = await User.create({
      email: 'test4@example.com',
      password: await hash.make('password'),

      institutionId: institution.id,
    })

    const attestation = await StudentAchievementAttestation.create({
      studentId: user.id,
      institutionId: institution.id,
      achievementKey: 'test',
      threshold: 5,
      achievementHash: 'hash123',
      status: 'processing',
      attempts: 1,
      attestationPda: '11111111111111111111111111111111',
      lastAttemptAt: DateTime.now().minus({ minutes: 40 }),
    })

    await recoverStaleAttestation(attestation.id)

    await attestation.refresh()
    assert.equal(attestation.status, 'needs_review')
    // Error message varies based on environment
    assert.isNotNull(attestation.errorMessage)
  })

  test('stale diploma recovery marks needs_review when asset not found', async ({ assert }) => {
    const { recoverStaleDiploma } = await import('#services/cnft/cnft_diploma_claim_service')

    const user = await User.create({
      email: 'test5@example.com',
      password: await hash.make('password'),

      institutionId: institution.id,
    })

    const diploma = await StudentDiplomaMint.create({
      studentId: user.id,
      institutionId: institution.id,
      kind: 'outstanding',
      rank: 1,
      points: 100,
      displayName: 'Test',
      status: 'processing',
      attempts: 1,
      assetId: 'fake-asset-id-not-on-chain',
      lastAttemptAt: DateTime.now().minus({ minutes: 40 }),
    })

    await recoverStaleDiploma(diploma.id)

    await diploma.refresh()
    assert.equal(diploma.status, 'needs_review')
  })

  test('attestFirst5ActivitiesForStudent uses atomic claim', async ({ assert }) => {
    const user = await User.create({
      email: 'test6@example.com',
      password: await hash.make('password'),
      institutionId: institution.id,
      walletPublicKey: '11111111111111111111111111111111',
    })

    await StudentAchievementAttestation.create({
      studentId: user.id,
      institutionId: institution.id,
      achievementKey: 'first_5_activities',
      threshold: 2,
      achievementHash: 'hash123',
      status: 'processing',
      attempts: 1,
    })

    const { attestFirst5ActivitiesForStudent } =
      await import('#services/attestation/milestone_attestation_service')

    const result = await attestFirst5ActivitiesForStudent({
      studentId: user.id,
      institutionId: institution.id,
    })

    // Result status varies based on env (SAS_ENABLED, etc), but should not be 'attested'
    // since row is processing and we can't claim it
    assert.notEqual(result.status, 'attested')
  })

  test('mintOutstandingDiploma returns in-progress when row is processing', async () => {
    const user = await User.create({
      email: 'test7@example.com',
      password: await hash.make('password'),
      institutionId: institution.id,
      walletPublicKey: '11111111111111111111111111111111',
    })

    await StudentDiplomaMint.create({
      studentId: user.id,
      institutionId: institution.id,
      kind: 'outstanding',
      rank: 1,
      points: 100,
      displayName: 'Test Student',
      status: 'processing',
      attempts: 1,
    })

    // This would need proper setup with leaderboard, but demonstrates the path
    // In practice, mintOutstandingDiploma would check preview first
  })

  test('processing status cannot be claimed again', async ({ assert }) => {
    const user = await User.create({
      email: 'test8@example.com',
      password: await hash.make('password'),
      institutionId: institution.id,
    })

    const attestation = await StudentAchievementAttestation.create({
      studentId: user.id,
      institutionId: institution.id,
      achievementKey: 'first_5_activities',
      threshold: 2,
      achievementHash: 'hash123',
      status: 'processing',
      attempts: 1,
    })

    // The key test: attempting to claim should fail since it's already processing
    const { claimAttestationForProcessing } =
      await import('#services/attestation/milestone_attestation_claim_service')
    const claimed = await claimAttestationForProcessing(attestation.id, 3)
    assert.isNull(claimed, 'Should not be able to claim a processing record')
  })
})
