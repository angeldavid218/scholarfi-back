import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import env from '#start/env'

test.group('grades:analyze-progress command', () => {
  test('exits cleanly when lock is held', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const { tryAcquireGlobalLock } = await import('#services/cron/global_lock_service')
    const lock = await tryAcquireGlobalLock('grades:analyze-progress')

    try {
      const result = await ace.exec('grades:analyze-progress', [])
      assert.equal(result.exitCode, 0)
    } finally {
      await lock.release()
    }
  })
})
