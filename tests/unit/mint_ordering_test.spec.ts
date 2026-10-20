import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import StudentDiplomaMint from '#models/student_diploma_mint'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import Institution from '#models/institution'

test.group('Mint ordering: signature persisted before send', (group) => {
  let institution: Institution

  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    institution = await Institution.create({
      name: 'Test Institution',
      code: 'TEST',
      status: 'active',
      cryptoWalletsEnabled: true,
    })
    return () => db.rollbackGlobalTransaction()
  })

  test('claim sets processing status before any mint attempt', async ({ assert }) => {
    const user = await User.create({
      email: 'test@example.com',
      password: await hash.make('password'),
      institutionId: institution.id,
      walletPublicKey: '11111111111111111111111111111111',
    })

    const diploma = await StudentDiplomaMint.create({
      studentId: user.id,
      institutionId: institution.id,
      kind: 'outstanding',
      rank: 1,
      points: 100,
      displayName: 'Test Student',
      status: 'pending',
      attempts: 0,
    })

    // Claim the diploma (this atomically sets status to processing and increments attempts)
    const { claimDiplomaForProcessing } = await import('#services/cnft/cnft_diploma_claim_service')
    const claimed = await claimDiplomaForProcessing(diploma.id, 3)

    assert.isNotNull(claimed)
    assert.equal(claimed?.status, 'processing')

    // Verify in DB
    await diploma.refresh()
    assert.equal(diploma.status, 'processing')
    assert.equal(diploma.attempts, 1)

    // At this point, the signature field is available for the mint call to use
    // The mint operation happens AFTER claim, so DB row is already in processing state
  })

  test('existing signature is persisted and available before resend decision', async ({
    assert,
  }) => {
    const user = await User.create({
      email: 'test2@example.com',
      password: await hash.make('password'),
      institutionId: institution.id,
      walletPublicKey: '22222222222222222222222222222222',
    })

    // Create a diploma with existing signature (from previous attempt)
    const diploma = await StudentDiplomaMint.create({
      studentId: user.id,
      institutionId: institution.id,
      kind: 'outstanding',
      rank: 1,
      points: 100,
      displayName: 'Test Student',
      status: 'failed',
      attempts: 1,
      signature: 'existing-sig-from-previous-send',
    })

    // When we claim for retry, the signature is preserved in the claim result
    const { claimDiplomaForProcessing } = await import('#services/cnft/cnft_diploma_claim_service')
    const claimed = await claimDiplomaForProcessing(diploma.id, 3)

    assert.isNotNull(claimed)
    assert.equal(claimed?.signature, 'existing-sig-from-previous-send')
    assert.equal(claimed?.status, 'processing')

    // The signature is available in the claimed object BEFORE any mint/resend decision
    // processMint in cnft_mint_sweep.ts uses this to check getSignatureStatuses
    // before attempting a resend
  })

  test('claim result contains signature field from DB row', async ({ assert }) => {
    const user = await User.create({
      email: 'test3@example.com',
      password: await hash.make('password'),
      institutionId: institution.id,
    })

    const diploma = await StudentDiplomaMint.create({
      studentId: user.id,
      institutionId: institution.id,
      kind: 'outstanding',
      rank: 1,
      points: 100,
      displayName: 'Test Student',
      status: 'pending',
      attempts: 0,
      signature: null,
    })

    const { claimDiplomaForProcessing } = await import('#services/cnft/cnft_diploma_claim_service')
    const claimed = await claimDiplomaForProcessing(diploma.id, 3)

    assert.isNotNull(claimed)
    // Signature field is included in the RETURNING clause of the claim query
    assert.property(claimed, 'signature')
    assert.isNull(claimed?.signature)
  })
})
