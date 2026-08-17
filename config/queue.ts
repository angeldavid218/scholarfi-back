import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/queue'

/**
 * @adonisjs/queue — pin package version; API may change while experimental.
 * Default: database (Postgres/SQLite). Tests: QUEUE_DRIVER=sync.
 */
export default defineConfig({
  default: env.get('QUEUE_DRIVER', env.get('NODE_ENV') === 'test' ? 'sync' : 'database'),

  adapters: {
    database: drivers.database({
      // Uses Lucid primary connection (DB_CONNECTION / pg|sqlite)
    }),
    sync: drivers.sync(),
  },

  worker: {
    // Keep Classroom reward issuance serialized across tasks for a teacher budget.
    concurrency: 1,
    idleDelay: '2s',
  },

  queues: {
    classroom: {
      retry: {
        maxRetries: 2,
      },
    },
  },

  locations: ['./app/jobs/**/*.{ts,js}'],
})
