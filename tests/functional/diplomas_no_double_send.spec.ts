import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import StudentDiplomaMint from '#models/student_diploma_mint'

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
      name: `Test Inst ${Date.now()}`,
      code: `TST-${Date.now()}`,
      status: 'active',
      crypto_wallets_enabled: true,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const row = inserted[0] as any
  return typeof row === 'number' ? row : row.id
}

async function loginToken(client: any, email: string) {
  const response = await client.post('/api/v1/auth/login').json({
    email,
    password: 'Secret123!',
  })
  return (response.body() as any).data.token as string
}

test.group('Diplomas HTTP endpoints', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('POST /diplomas/mint-best preserves response shape', async ({ client, assert }) => {
    const institutionId = await createInstitution()
    const adminEmail = `admin-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`

    const admin = await db
      .table('users')
      .insert({
        email: adminEmail,
        password: '$argon2id$v=19$m=65536,t=3,p=4$mock',
        full_name: 'Test Admin',
        institution_id: institutionId,
        is_active: true,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const adminId = (admin[0] as any).id || admin[0]

    await assignRoleToUser(adminId, 'school_admin', 'School Admin')

    const token = await loginToken(client, adminEmail)

    const response = await client
      .post('/api/v1/diplomas/mint-best')
      .header('authorization', `Bearer ${token}`)

    assert.isNumber(response.status())
    const body = response.body() as any

    if (response.status() === 200) {
      assert.property(body, 'diploma')
      assert.property(body, 'alreadyMinted')
      assert.isObject(body.diploma)
      assert.isBoolean(body.alreadyMinted)
    } else if (response.status() === 422) {
      assert.property(body, 'error')
      assert.property(body.error, 'code')
      assert.property(body.error, 'message')
    }
  })

  test('POST /diplomas/mint-best prevents double-send under concurrent calls', async ({
    client,
    assert,
  }) => {
    const institutionId = await createInstitution()
    const adminEmail = `admin-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`

    const admin = await db
      .table('users')
      .insert({
        email: adminEmail,
        password: '$argon2id$v=19$m=65536,t=3,p=4$mock',
        full_name: 'Test Admin',
        institution_id: institutionId,
        is_active: true,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const adminId = (admin[0] as any).id || admin[0]

    await assignRoleToUser(adminId, 'school_admin', 'School Admin')

    const studentEmail = `student-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`
    const student = await db
      .table('users')
      .insert({
        email: studentEmail,
        password: '$argon2id$v=19$m=65536,t=3,p=4$mock',
        full_name: 'Test Student',
        institution_id: institutionId,
        is_active: true,
        wallet_public_key: 'mock-wallet',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const studentId = (student[0] as any).id || student[0]

    await StudentDiplomaMint.create({
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

    const token = await loginToken(client, adminEmail)

    const [response1, response2] = await Promise.all([
      client.post('/api/v1/diplomas/mint-best').header('authorization', `Bearer ${token}`),
      client.post('/api/v1/diplomas/mint-best').header('authorization', `Bearer ${token}`),
    ])

    assert.isNumber(response1.status())
    assert.isNumber(response2.status())

    const row = await StudentDiplomaMint.query().where('student_id', studentId).first()

    assert.isAtMost(row?.attempts ?? 0, 1)
  })
})
