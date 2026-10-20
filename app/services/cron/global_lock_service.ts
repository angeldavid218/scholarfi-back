import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { Client } from 'pg'

export interface GlobalLock {
  acquired: boolean
  release: () => Promise<void>
}

/**
 * Acquire a Postgres advisory lock for the duration of a cron command run.
 * Uses a dedicated connection that persists for the lock lifetime.
 * IMPORTANT: Requires a direct database connection (not PgBouncer in transaction mode).
 * Returns { acquired: false } if another process holds the lock (overlap detected).
 */
export async function tryAcquireGlobalLock(lockName: string): Promise<GlobalLock> {
  const lockId = hashStringToInt32(lockName)

  // Get a dedicated connection that will persist for the lock lifetime
  const connection = db.connection()
  const client = await connection.getWriteClient()

  let acquired = false

  try {
    const result = await client.raw('SELECT pg_try_advisory_lock(?) as acquired', [lockId])
    acquired = result.rows[0]?.acquired === true

    if (!acquired) {
      logger.info({ lockName, lockId }, 'Global lock already held by another process')
      await client.release()
      return {
        acquired: false,
        release: async () => {},
      }
    }

    logger.info({ lockName, lockId }, 'Global lock acquired')

    return {
      acquired: true,
      release: async () => {
        try {
          const unlockResult = await client.raw('SELECT pg_advisory_unlock(?) as unlocked', [
            lockId,
          ])
          const unlocked = unlockResult.rows[0]?.unlocked === true
          if (!unlocked) {
            logger.warn({ lockName, lockId }, 'Advisory unlock returned false (lock not held)')
          } else {
            logger.info({ lockName, lockId }, 'Global lock released')
          }
        } catch (error) {
          logger.error({ err: error, lockName, lockId }, 'Failed to release advisory lock')
        } finally {
          await client.release()
        }
      },
    }
  } catch (error) {
    logger.error({ err: error, lockName, lockId }, 'Failed to acquire advisory lock')
    await client.release()
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
