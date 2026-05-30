import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

try {
  const ClientBetterSQLite3 = require('knex/lib/dialects/better-sqlite3/index.js')
  ClientBetterSQLite3.prototype._formatBindings = function (bindings: any) {
    if (!bindings) {
      return []
    }
    return bindings.map((binding: any) => {
      if (binding instanceof Date) {
        const pad = (n: number, size = 2) => String(n).padStart(size, '0')
        return (
          binding.getUTCFullYear() +
          '-' +
          pad(binding.getUTCMonth() + 1) +
          '-' +
          pad(binding.getUTCDate()) +
          ' ' +
          pad(binding.getUTCHours()) +
          ':' +
          pad(binding.getUTCMinutes()) +
          ':' +
          pad(binding.getUTCSeconds()) +
          '.' +
          pad(binding.getUTCMilliseconds(), 3)
        )
      }

      if (typeof binding === 'boolean') {
        return Number(binding)
      }

      return binding
    })
  }
} catch (e) {
  console.error('FAILED TO PATCH better-sqlite3 knex dialect:', e)
}

import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { dbAssertions } from '@adonisjs/lucid/plugins/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'
import type { Registry } from '../.adonisjs/client/registry/schema.d.ts'

/**
 * This file is imported by the "bin/test.ts" entrypoint file
 */
declare module '@japa/api-client/types' {
  interface RoutesRegistry extends Registry {}
}

/**
 * This file is imported by the "bin/test.ts" entrypoint file
 */

/**
 * Configure Japa plugins in the plugins array.
 * Learn more - https://japa.dev/docs/runner-config#plugins-optional
 */
export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  dbAssertions(app),
  apiClient(),
  sessionApiClient(app),
  authApiClient(app),
]

/**
 * Configure lifecycle function to run before and after all the
 * tests.
 *
 * The setup functions are executed before all the tests
 * The teardown functions are executed after all the tests
 */
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
}

/**
 * Configure suites by tapping into the test suite instance.
 * Learn more - https://japa.dev/docs/test-suites#lifecycle-hooks
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
