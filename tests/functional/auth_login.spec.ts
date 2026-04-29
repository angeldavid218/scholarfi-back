import User from '#models/user'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

test.group('Auth login', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('returns token and user payload for valid credentials', async ({ client, assert }) => {
    const user = await User.create({
      email: 'teacher@example.com',
      password: 'Secret123!',
      fullName: 'Teacher Demo',
    })

    const response = await client.post('/api/v1/auth/login').json({
      email: 'teacher@example.com',
      password: 'Secret123!',
    })

    response.assertStatus(200)
    const body = response.body() as any
    assert.equal(body.data.user.email, user.email)
    assert.property(body.data, 'token')
    assert.isString(body.data.token)
    assert.isAbove(body.data.token.length, 0)
  })

  test('returns standardized envelope for invalid credentials', async ({ client, assert }) => {
    await User.create({
      email: 'student@example.com',
      password: 'Secret123!',
      fullName: 'Student Demo',
    })

    const response = await client.post('/api/v1/auth/login').json({
      email: 'student@example.com',
      password: 'wrong-password',
    })

    response.assertStatus(401)
    response.assertBodyContains({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
    })
    const body = response.body() as any
    assert.isString(body.error.requestId)
    assert.isAbove(body.error.requestId.length, 0)
  })
})
