import User from '#models/user'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

test.group('Auth logout', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('revokes token and denies subsequent protected requests', async ({ client, assert }) => {
    await User.create({
      email: 'logout-user@example.com',
      password: 'Secret123!',
      fullName: 'Logout User',
    })

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'logout-user@example.com',
      password: 'Secret123!',
    })

    loginResponse.assertStatus(200)
    const loginBody = loginResponse.body() as any
    const token = loginBody.data.token as string
    assert.isString(token)
    assert.isAbove(token.length, 0)

    const logoutResponse = await client
      .post('/api/v1/auth/logout')
      .header('authorization', `Bearer ${token}`)

    logoutResponse.assertStatus(200)

    const protectedResponse = await client
      .get('/api/v1/account/profile')
      .header('authorization', `Bearer ${token}`)

    protectedResponse.assertStatus(401)
    protectedResponse.assertBodyContains({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
      },
    })

    const protectedBody = protectedResponse.body() as any
    assert.isString(protectedBody.error.requestId)
    assert.isAbove(protectedBody.error.requestId.length, 0)
  })
})
