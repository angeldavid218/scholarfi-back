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
      name: `Diploma Inst ${Date.now()}`,
      code: `DIP-${Date.now()}`,
      status: 'active',
      created_by: null,
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

test.group('cNFT diplomas', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('student can list empty diplomas and cannot mint', async ({ client, assert }) => {
    const institutionId = await createInstitution()
    const student = await User.create({
      email: 'dip-student@example.com',
      password: 'Secret123!',
      fullName: 'Diploma Student',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(student.id, 'student', 'Student')
    const token = await loginToken(client, student.email)

    const me = await client.get('/api/v1/diplomas/me').header('authorization', `Bearer ${token}`)
    me.assertStatus(200)
    assert.deepEqual((me.body() as any).diplomas ?? (me.body() as any).data?.diplomas ?? [], [])

    const mint = await client
      .post('/api/v1/diplomas/mint-best')
      .header('authorization', `Bearer ${token}`)
    mint.assertStatus(403)
  })

  test('school admin mint is rejected in mock mode', async ({ client, assert }) => {
    const institutionId = await createInstitution()
    const admin = await User.create({
      email: 'dip-admin@example.com',
      password: 'Secret123!',
      fullName: 'Diploma Admin',
      institutionId,
      isActive: true,
    })
    await assignRoleToUser(admin.id, 'school_admin', 'School Admin')
    const token = await loginToken(client, admin.email)

    const mint = await client
      .post('/api/v1/diplomas/mint-best')
      .header('authorization', `Bearer ${token}`)
    mint.assertStatus(422)
    assert.equal((mint.body() as any).error.code, 'CNFT_NOT_ENABLED')
  })

  test('public diploma metadata 404s for unknown id', async ({ client }) => {
    const res = await client.get('/api/v1/public/diplomas/999999.json')
    res.assertStatus(404)
  })
})
