/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // Token / ledger execution (mock = demo, solana = devnet custodial)
  TOKEN_MODE: Env.schema.enum.optional(['mock', 'solana'] as const),
  SOLANA_RPC_URL: Env.schema.string.optional(),
  SCHOLARFI_TOKEN_MINT: Env.schema.string.optional(),
  MINT_AUTHORITY_SECRET: Env.schema.string.optional(),
  TREASURY_WALLET_PUBLIC_KEY: Env.schema.string.optional(),
  WALLET_ENCRYPTION_KEY: Env.schema.string.optional(),

  // Google Classroom integration
  GOOGLE_CLIENT_ID: Env.schema.string.optional(),
  GOOGLE_CLIENT_SECRET: Env.schema.string.optional(),
  GOOGLE_REDIRECT_URI: Env.schema.string.optional({ format: 'url', tld: false }),
  GOOGLE_OAUTH_SCOPES: Env.schema.string.optional(),
  INTEGRATION_TOKEN_ENCRYPTION_KEY: Env.schema.string.optional(),
  FRONTEND_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  GOOGLE_CLASSROOM_MOCK: Env.schema.string.optional(),

  // DB (validated when using pg in config)
  DB_HOST: Env.schema.string.optional(),
  DB_PORT: Env.schema.number.optional(),
  DB_USER: Env.schema.string.optional(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string.optional(),
})
