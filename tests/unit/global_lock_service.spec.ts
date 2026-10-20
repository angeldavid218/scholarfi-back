import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { tryAcquireGlobalLock } from '#services/cron/global_lock_service'
import env from '#start/env'

test.group('Global lock service', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('can acquire and release a lock', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const lock1 = await tryAcquireGlobalLock('test-lock')
    assert.isTrue(lock1.acquired)

    await lock1.release()
    const lock2 = await tryAcquireGlobalLock('test-lock')
    assert.isTrue(lock2.acquired)

    await lock2.release()
  })

  test('prevents concurrent acquisition of same lock', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const lock1 = await tryAcquireGlobalLock('test-concurrent')
    assert.isTrue(lock1.acquired)

    const lock2 = await tryAcquireGlobalLock('test-concurrent')
    assert.isFalse(lock2.acquired)

    await lock1.release()

    const lock3 = await tryAcquireGlobalLock('test-concurrent')
    assert.isTrue(lock3.acquired)

    await lock3.release()
  })

  test('different lock names do not conflict', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const lock1 = await tryAcquireGlobalLock('lock-a')
    const lock2 = await tryAcquireGlobalLock('lock-b')

    assert.isTrue(lock1.acquired)
    assert.isTrue(lock2.acquired)

    await lock1.release()
    await lock2.release()
  })
})
