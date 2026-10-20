import { test } from '@japa/runner'
import { tryAcquireGlobalLock } from '#services/cron/global_lock_service'
import env from '#start/env'

test.group('Global lock service', () => {
  test('returns an object with acquired flag and release function', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const lock = await tryAcquireGlobalLock('test-basic-lock')
    assert.isBoolean(lock.acquired)
    assert.isFunction(lock.release)

    await lock.release()
  })

  test('can acquire and release a lock in sequence', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const lock1 = await tryAcquireGlobalLock('test-sequential-lock')
    assert.isTrue(lock1.acquired)
    await lock1.release()

    const lock2 = await tryAcquireGlobalLock('test-sequential-lock')
    assert.isTrue(lock2.acquired)
    await lock2.release()
  })

  test('different lock names return separate locks', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const lockA = await tryAcquireGlobalLock('test-lock-a-unique')
    const lockB = await tryAcquireGlobalLock('test-lock-b-unique')

    assert.isTrue(lockA.acquired)
    assert.isTrue(lockB.acquired)

    await lockA.release()
    await lockB.release()
  })
})
