import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

export interface GlobalLock {
  acquired: boolean
  release: () => Promise<void>
}

/**
 * Acquire a Postgres advisory lock for the duration of a cron command run.
 * Uses a transaction-level advisory lock (pg_try_advisory_xact_lock) which is
 * automatically released when the transaction ends.
 * IMPORTANT: Requires a direct database connection (not PgBouncer in transaction mode).
 * Returns { acquired: false } if another process holds the lock (overlap detected).
 */
export async function tryAcquireGlobalLock(lockName: string): Promise<GlobalLock> {
  const lockId = hashStringToInt32(lockName)

  // Use a transaction for xact-level advisory lock
  const trx = await db.transaction()

  try {
    const result = await trx.rawQuery('SELECT pg_try_advisory_xact_lock(?) as acquired', [lockId])
    const acquired = result.rows[0]?.acquired === true

    if (!acquired) {
      logger.info({ lockName, lockId }, 'Global lock already held by another process')
      await trx.rollback()
      return {
        acquired: false,
        release: async () => {},
      }
    }

    logger.info({ lockName, lockId }, 'Global lock acquired (xact-level)')

    return {
      acquired: true,
      release: async () => {
        try {
          logger.info({ lockName, lockId }, 'Releasing global lock (committing transaction)')
          await trx.commit()
        } catch (error) {
          logger.error({ err: error, lockName, lockId }, 'Failed to commit transaction')
          await trx.rollback()
        }
      },
    }
  } catch (error) {
    logger.error({ err: error, lockName, lockId }, 'Failed to acquire advisory lock')
    await trx.rollback()
    throw error
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
