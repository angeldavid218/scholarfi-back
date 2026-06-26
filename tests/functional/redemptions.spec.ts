import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

async function ensureRole(roleKey: string, roleLabel: string) {
  const existingRole = await db.from('roles').where('key', roleKey).first()
  if (existingRole) return existingRole.id as number
  const inserted = await db
    .table('roles')
    .insert({
      key: roleKey,
      label: roleLabel,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

async function assignRoleToUser(userId: number, roleKey: string, roleLabel: string) {
  const roleId = await ensureRole(roleKey, roleLabel)
  await db.table('user_roles').insert({
    user_id: userId,
    role_id: roleId,
    created_at: new Date(),
    updated_at: null,
  })
}

async function createInstitution() {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `Redeem Inst ${Date.now()}`,
      code: `RD-${Date.now()}`,
      status: 'active',
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

async function loginToken(client: any, email: string) {
  const response = await client.post('/api/v1/auth/login').json({
    email,
    password: 'Secret123!',
  })
  return (response.body() as any).data.token as string
}

test.group('Redemptions', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('student creates redemption and admin completes it (mock credits)', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution()

    const admin = await User.create({
      email: 'rd-admin@example.com',
      password: 'Secret123!',
      fullName: 'Rd Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const student = await User.create({
      email: 'rd-student@example.com',
      password: 'Secret123!',
      fullName: 'Rd Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const tokenService = await import('#services/tokens/factory').then((m) => m.makeTokenService())
    await tokenService.createWallet(String(student.id))
    await db.from('token_balances').where('user_id', student.id).update({
      balance: 100,
      updated_at: new Date(),
    })

    const catalogInsert = await db
      .table('catalog_rewards')
      .insert({
        institution_id: institutionId,
        title: 'Sticker pack',
        description: 'Demo',
        credit_cost: 30,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const cr = catalogInsert[0] as any
    const rewardId = typeof cr === 'number' ? cr : cr.id

    const studentToken = await loginToken(client, student.email)
    const createRes = await client
      .post('/api/v1/redemptions')
      .header('authorization', `Bearer ${studentToken}`)
      .json({ rewardId })
    createRes.assertStatus(200)
    const redemptionId = (createRes.body() as any).data.id as number

    const adminToken = await loginToken(client, admin.email)
    const approveRes = await client
      .patch(`/api/v1/redemptions/${redemptionId}/approve`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({})
    approveRes.assertStatus(200)

    const bal = await db.from('token_balances').where('user_id', student.id).first()
    assert.equal(Number(bal.balance), 70)

    const rd = await db.from('redemptions').where('id', redemptionId).first()
    assert.equal(rd.status, 'completed')
  })
})
