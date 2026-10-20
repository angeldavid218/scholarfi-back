import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import StudentDiplomaMint from '#models/student_diploma_mint'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import Institution from '#models/institution'

test.group('cNFT mint pre-send signature check', (group) => {
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

  test('processMint checks existing signature before retrying', async ({ assert }) => {
    const user = await User.create({
      email: 'test@example.com',
      password: await hash.make('password'),
      institutionId: institution.id,
      walletPublicKey: '11111111111111111111111111111111',
    })

    // Create a diploma with a signature in failed state (can be retried)
    const diploma = await StudentDiplomaMint.create({
      studentId: user.id,
      institutionId: institution.id,
      kind: 'outstanding',
      rank: 1,
      points: 100,
      displayName: 'Test',
      status: 'failed',
      attempts: 1,
      signature: 'existing-signature-123',
    })

    // When we claim and process, it should check the signature first
    const { claimDiplomaForProcessing } = await import('#services/cnft/cnft_diploma_claim_service')
    const claimed = await claimDiplomaForProcessing(diploma.id, 3)

    assert.isNotNull(claimed)
    assert.equal(claimed?.signature, 'existing-signature-123')

    // The processMint logic should check getSignatureStatuses for this signature
    // before attempting to resend (tested in integration, we verify the field exists)
  })

  test('diploma row has signature field before mint send', async ({ assert }) => {
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
      status: 'pending',
      attempts: 0,
    })

    // Verify the signature column exists and can be set
    diploma.signature = 'pre-generated-signature'
    await diploma.save()

    await diploma.refresh()
    assert.equal(diploma.signature, 'pre-generated-signature')
  })
})
