import { DEMO_LOGIN_ACCOUNTS, DEMO_PASSWORD } from '#fixtures/demo_accounts'
import { buildPublicDemoConfig } from '#services/demo_config_service'
import { test } from '@japa/runner'

test.group('Public demo config', () => {
  test('disabled payload omits accounts', ({ assert }) => {
    assert.deepEqual(buildPublicDemoConfig(false), { enabled: false })
  })

  test('enabled payload includes demo accounts and password', ({ assert }) => {
    const config = buildPublicDemoConfig(true)
    assert.isTrue(config.enabled)
    if (!config.enabled) return

    assert.isTrue(config.classroomMock)
    assert.equal(config.password, DEMO_PASSWORD)
    assert.deepEqual(config.accounts, DEMO_LOGIN_ACCOUNTS)
  })
})
