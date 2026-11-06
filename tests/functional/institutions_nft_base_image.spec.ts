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

async function createSuperAdmin(client: any, email: string) {
  await User.create({
    email,
    password: 'Secret123!',
    fullName: 'Super Admin NFT Base',
  })
  const user = await User.findByOrFail('email', email)
  await assignRoleToUser(user.id, 'super_admin', 'Super Admin')
  const loginResponse = await client.post('/api/v1/auth/login').json({
    email,
    password: 'Secret123!',
  })
  return (loginResponse.body() as any).data.token as string
}

async function createInstitution(codeSuffix: string) {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `NFT Base Institution ${codeSuffix}`,
      code: `NFT-${codeSuffix}`,
      status: 'active',
      crypto_wallets_enabled: false,
      created_by: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const created = inserted[0] as any
  return typeof created === 'number' ? created : created.id
}

test.group('Institutions NFT base image', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('super admin can set and clear institution nft base image url', async ({ client, assert }) => {
    const institutionId = await createInstitution(String(Date.now()))
    const token = await createSuperAdmin(client, `super-nft-${Date.now()}@example.com`)
    const imageUrl = 'https://cdn.example.com/schools/pilot/diploma-base.png'

    const setResponse = await client
      .patch(`/api/v1/institutions/${institutionId}/nft-base-image`)
      .header('authorization', `Bearer ${token}`)
      .json({ nftBaseImageUrl: imageUrl })
    setResponse.assertStatus(200)
    assert.equal((setResponse.body() as any).data.nftBaseImageUrl, imageUrl)

    const list = await client.get('/api/v1/institutions').header('authorization', `Bearer ${token}`)
    list.assertStatus(200)
    const row = ((list.body() as any).data as any[]).find((item) => item.id === institutionId)
    assert.equal(row?.nftBaseImageUrl, imageUrl)

    const clearResponse = await client
      .patch(`/api/v1/institutions/${institutionId}/nft-base-image`)
      .header('authorization', `Bearer ${token}`)
      .json({ nftBaseImageUrl: null })
    clearResponse.assertStatus(200)
    assert.isNull((clearResponse.body() as any).data.nftBaseImageUrl)
  })

  test('rejects invalid nft base image url', async ({ client }) => {
    const institutionId = await createInstitution(String(Date.now()))
    const token = await createSuperAdmin(client, `super-nft-bad-${Date.now()}@example.com`)

    const response = await client
      .patch(`/api/v1/institutions/${institutionId}/nft-base-image`)
      .header('authorization', `Bearer ${token}`)
      .json({ nftBaseImageUrl: 'not-a-url' })
    response.assertStatus(422)
  })

  test('non-super-admin cannot change nft base image', async ({ client }) => {
    const institutionId = await createInstitution(String(Date.now()))
    const teacherEmail = `teacher-nft-${Date.now()}@example.com`

    await User.create({
      email: teacherEmail,
      password: 'Secret123!',
      fullName: 'Teacher NFT',
    })
    const teacher = await User.findByOrFail('email', teacherEmail)
    await assignRoleToUser(teacher.id, 'teacher', 'Teacher')

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: teacherEmail,
      password: 'Secret123!',
    })
    const token = (loginResponse.body() as any).data.token as string

    const response = await client
      .patch(`/api/v1/institutions/${institutionId}/nft-base-image`)
      .header('authorization', `Bearer ${token}`)
      .json({ nftBaseImageUrl: 'https://cdn.example.com/x.png' })
    response.assertStatus(403)
  })
})
