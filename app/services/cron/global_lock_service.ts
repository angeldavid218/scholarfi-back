import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

export interface GlobalLock {
  acquired: boolean
  release: () => Promise<void>
}

/**
 * Acquire a Postgres advisory lock for the duration of a cron command run.
 * Uses a session-level advisory lock OR a no-op implementation for non-Postgres dialects.
 * IMPORTANT: Requires a direct database connection (not PgBouncer in transaction mode).
 * Returns { acquired: false } if another process holds the lock (overlap detected).
 */
export async function tryAcquireGlobalLock(lockName: string): Promise<GlobalLock> {
  const dialect = env.get('DB_CONNECTION')

  if (dialect !== 'pg') {
    // No-op implementation for non-Postgres dialects
    logger.info({ lockName, dialect }, 'Advisory lock skipped (non-Postgres dialect)')
    return {
      acquired: true,
      release: async () => {},
    }
  }

  const lockId = hashStringToInt32(lockName)

  // For Postgres: use raw query with bound parameters
  // This keeps the connection open for the query lifetime
  let released = false

  const result = await db.rawQuery('SELECT pg_try_advisory_lock(?) as acquired', [lockId])
  const acquired = result.rows[0]?.acquired === true

  if (!acquired) {
    logger.info({ lockName, lockId }, 'Global lock already held by another process')
    return {
      acquired: false,
      release: async () => {},
    }
  }

  logger.info({ lockName, lockId }, 'Global lock acquired (session-level)')

  return {
    acquired: true,
    release: async () => {
      if (released) return
      released = true

      try {
        const unlockResult = await db.rawQuery('SELECT pg_advisory_unlock(?) as unlocked', [lockId])
        const unlocked = unlockResult.rows[0]?.unlocked === true
        if (!unlocked) {
          logger.warn({ lockName, lockId }, 'Advisory unlock returned false (lock not held)')
        } else {
          logger.info({ lockName, lockId }, 'Global lock released')
        }
      } catch (error) {
        logger.error({ err: error, lockName, lockId }, 'Failed to release advisory lock')
      }
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
