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

  test('concurrent lock attempts on same name fail for second caller', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const lock1 = await tryAcquireGlobalLock('test-concurrent-lock')
    assert.isTrue(lock1.acquired)

    const lock2 = await tryAcquireGlobalLock('test-concurrent-lock')
    assert.isFalse(lock2.acquired)

    await lock1.release()
  })

  test('lock persists for duration of hold (dedicated connection)', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const lock = await tryAcquireGlobalLock('test-lock-persistence-check')
    assert.isTrue(lock.acquired)

    // Sleep briefly to simulate work
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Lock should still be held
    const lock2 = await tryAcquireGlobalLock('test-lock-persistence-check')
    assert.isFalse(lock2.acquired)

    await lock.release()

    // Now it should be available
    const lock3 = await tryAcquireGlobalLock('test-lock-persistence-check')
    assert.isTrue(lock3.acquired)
    await lock3.release()
  })
})
