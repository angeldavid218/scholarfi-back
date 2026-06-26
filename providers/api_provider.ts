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
  // Ignore error if better-sqlite3 is not loaded
}

import { HttpContext } from '@adonisjs/core/http'
import { BaseSerializer } from '@adonisjs/core/transformers'
import { type SimplePaginatorMetaKeys } from '@adonisjs/lucid/types/querybuilder'

/**
 * Custom serializer for API responses that ensures consistent JSON structure
 * across all API endpoints. Wraps response data in a 'data' property and handles
 * pagination metadata for Lucid ORM query results.
 */
class ApiSerializer extends BaseSerializer<{
  Wrap: 'data'
  PaginationMetaData: SimplePaginatorMetaKeys
}> {
  /**
   * Wraps all serialized data under this key in the response object.
   * Example: { data: [...] } instead of returning raw arrays/objects
   */
  wrap: 'data' = 'data'

  /**
   * Validates and defines pagination metadata structure for paginated responses.
   * Ensures that pagination info from Lucid queries is properly formatted.
   *
   * @throws Error if metadata doesn't match Lucid's pagination structure
   */
  definePaginationMetaData(metaData: unknown): SimplePaginatorMetaKeys {
    if (!this.isLucidPaginatorMetaData(metaData)) {
      throw new Error(
        'Invalid pagination metadata. Expected metadata to contain Lucid pagination keys'
      )
    }
    return metaData
  }
}

/**
 * Single instance of ApiSerializer used across the application
 */
const serializer = new ApiSerializer()
const serialize = Object.assign(
  function (this: HttpContext, ...[data, resolver]: Parameters<ApiSerializer['serialize']>) {
    return serializer.serialize(data, resolver ?? this.containerResolver)
  },
  {
    withoutWrapping(
      this: HttpContext,
      ...[data, resolver]: Parameters<ApiSerializer['serializeWithoutWrapping']>
    ) {
      return serializer.serializeWithoutWrapping(data, resolver ?? this.containerResolver)
    },
  }
) as ApiSerializer['serialize'] & { withoutWrapping: ApiSerializer['serializeWithoutWrapping'] }

/**
 * Adds the serialize method to all HttpContext instances.
 * Usage in controllers: return ctx.serialize(data)
 * This ensures all API responses follow the same structure with data wrapping.
 */
HttpContext.instanceProperty('serialize', serialize)

/**
 * Module augmentation to add the serialize method to HttpContext.
 * This allows controllers to use ctx.serialize() for consistent API responses.
 */
declare module '@adonisjs/core/http' {
  export interface HttpContext {
    serialize: typeof serialize
  }
}
