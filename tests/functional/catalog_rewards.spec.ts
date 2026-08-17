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
      name: `Catalog Inst ${Date.now()}`,
      code: `CR-${Date.now()}`,
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

test.group('Catalog rewards', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('school admin creates and updates internal reward; students only see active', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution()

    const admin = await User.create({
      email: 'cr-admin@example.com',
      password: 'Secret123!',
      fullName: 'Catalog Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')

    const student = await User.create({
      email: 'cr-student@example.com',
      password: 'Secret123!',
      fullName: 'Catalog Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')

    const adminToken = await loginToken(client, admin.email)
    const createRes = await client
      .post('/api/v1/rewards/catalog')
      .header('authorization', `Bearer ${adminToken}`)
      .json({
        title: 'Pase biblioteca',
        description: 'Acceso temporal',
        creditCost: 40,
      })
    createRes.assertStatus(200)
    const created = (createRes.body() as any).data
    assert.equal(created.title, 'Pase biblioteca')
    assert.equal(created.creditCost, 40)
    assert.equal(created.isActive, true)
    assert.equal(created.source, 'internal')

    const studentToken = await loginToken(client, student.email)
    const studentListActive = await client
      .get('/api/v1/rewards/catalog')
      .header('authorization', `Bearer ${studentToken}`)
    studentListActive.assertStatus(200)
    assert.lengthOf((studentListActive.body() as any).data, 1)

    const updateRes = await client
      .patch(`/api/v1/rewards/catalog/${created.id}`)
      .header('authorization', `Bearer ${adminToken}`)
      .json({
        title: 'Pase biblioteca plus',
        creditCost: 55,
        isActive: false,
      })
    updateRes.assertStatus(200)
    const updated = (updateRes.body() as any).data
    assert.equal(updated.title, 'Pase biblioteca plus')
    assert.equal(updated.creditCost, 55)
    assert.equal(updated.isActive, false)

    const studentListInactive = await client
      .get('/api/v1/rewards/catalog')
      .header('authorization', `Bearer ${studentToken}`)
    studentListInactive.assertStatus(200)
    assert.lengthOf((studentListInactive.body() as any).data, 0)

    const adminList = await client
      .get('/api/v1/rewards/catalog')
      .header('authorization', `Bearer ${adminToken}`)
    adminList.assertStatus(200)
    assert.lengthOf((adminList.body() as any).data, 1)
    assert.equal((adminList.body() as any).data[0].isActive, false)
  })

  test('student cannot redeem inactive reward', async ({ client }) => {
    const institutionId = await createInstitution()

    const student = await User.create({
      email: 'cr-redeem-student@example.com',
      password: 'Secret123!',
      fullName: 'Redeem Student',
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
        title: 'Inactive reward',
        description: null,
        credit_cost: 20,
        is_active: false,
        source: 'internal',
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
    createRes.assertStatus(404)
  })
})
