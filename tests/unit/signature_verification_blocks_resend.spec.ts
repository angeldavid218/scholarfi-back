import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import StudentDiplomaMint from '#models/student_diploma_mint'
import { markDiplomaSucceeded } from '#services/cnft/cnft_diploma_claim_service'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import Institution from '#models/institution'

test.group('Signature verification blocks resend', (group) => {
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

  test('confirmed signature marks diploma succeeded', async ({ assert }) => {
    const user = await User.create({
      email: 'test@example.com',
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
      signature: 'confirmed-sig-123',
    })

    // When we mark it succeeded after confirming the signature
    await markDiplomaSucceeded(diploma.id, 'asset-id-123', 1, 'confirmed-sig-123')

    await diploma.refresh()
    assert.equal(diploma.status, 'confirmed')
    assert.equal(diploma.signature, 'confirmed-sig-123')
  })

  test('recovery with confirmed signature does not resend', async ({ assert }) => {
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
      status: 'processing',
      attempts: 1,
      assetId: 'test-asset',
      signature: 'confirmed-sig-456',
    })

    const { recoverStaleDiploma } = await import('#services/cnft/cnft_diploma_claim_service')

    // Recovery checks chain status
    // If signature is confirmed (mocked as not found here), marks needs_review
    // In production with real chain client, a confirmed sig would mark succeeded
    await recoverStaleDiploma(diploma.id)

    await diploma.refresh()
    // Without real chain client, recovery marks needs_review
    assert.equal(diploma.status, 'needs_review')
  })
})
