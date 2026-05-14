import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

/**
 * Lucid schema generator rules. `encrypted_wallet_secret` uses `@column({ serializeAs: null })`
 * in `database/schema.ts` — re-apply after `schema:generate` if that column loses the decorator.
 */
export default {} satisfies SchemaRules
