import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

export interface GlobalLock {
  acquired: boolean
  release: () => Promise<void>
}

/**
 * Acquire a Postgres advisory lock for the duration of a cron command run.
 * Returns { acquired: false } if another process holds the lock (overlap detected).
 */
export async function tryAcquireGlobalLock(lockName: string): Promise<GlobalLock> {
  const lockId = hashStringToInt32(lockName)

  const result = await db.rawQuery('SELECT pg_try_advisory_lock(?) as pg_try_advisory_lock', [
    lockId,
  ])

  const acquired = (result.rows[0] as any)?.pg_try_advisory_lock === true

  if (!acquired) {
    logger.info({ lockName, lockId }, 'Global lock already held by another process')
    return {
      acquired: false,
      release: async () => {},
    }
  }

  logger.info({ lockName, lockId }, 'Global lock acquired')

  return {
    acquired: true,
    release: async () => {
      await db.rawQuery('SELECT pg_advisory_unlock(?)', [lockId])
      logger.info({ lockName, lockId }, 'Global lock released')
    },
  }
}

/**
 * Simple hash function to convert a lock name to a 32-bit integer for Postgres advisory locks.
 */
function hashStringToInt32(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash
}
