import testUtils from '@adonisjs/core/services/test_utils'
import { DEMO_LOGIN_ACCOUNTS, DEMO_PASSWORD } from '#fixtures/demo_accounts'
import { test } from '@japa/runner'

test.group('Public demo config endpoint', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('returns sandbox accounts when GOOGLE_CLASSROOM_MOCK is on', async ({ client, assert }) => {
    const response = await client.get('/api/v1/public/demo-config')
    response.assertStatus(200)

    const body = response.body() as {
      data: {
        enabled: boolean
        classroomMock?: boolean
        password?: string
        accounts?: Array<{ role: string; email: string; label: string }>
      }
    }

    assert.isTrue(body.data.enabled)
    assert.isTrue(body.data.classroomMock)
    assert.equal(body.data.password, DEMO_PASSWORD)
    assert.deepEqual(body.data.accounts, DEMO_LOGIN_ACCOUNTS)
  })
})
