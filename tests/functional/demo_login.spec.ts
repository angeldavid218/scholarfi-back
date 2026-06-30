import User from '#models/user'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

test.group('Demo baseline login', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('verifyCredentials works when hash service is lazy-bound', async ({ assert }) => {
    await User.create({
      email: 'demo.teacher@scholarfi.test',
      password: 'DemoPass123!',
      fullName: 'Demo Teacher',
      isActive: true,
    })

    const user = await User.verifyCredentials('demo.teacher@scholarfi.test', 'DemoPass123!')
    assert.equal(user.email, 'demo.teacher@scholarfi.test')
  })

  test('demo teacher can login via API', async ({ client, assert }) => {
    await User.create({
      email: 'demo-login-api@scholarfi.test',
      password: 'DemoPass123!',
      fullName: 'Demo Teacher API',
      isActive: true,
    })

    const response = await client.post('/api/v1/auth/login').json({
      email: 'demo-login-api@scholarfi.test',
      password: 'DemoPass123!',
    })

    response.assertStatus(200)
    const body = response.body() as { data: { token: string; user: { email: string } } }
    assert.equal(body.data.user.email, 'demo-login-api@scholarfi.test')
    assert.isString(body.data.token)
  })
})
