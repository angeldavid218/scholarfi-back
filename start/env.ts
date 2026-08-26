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

  // Compressed NFT diplomas (Bubblegum). RPC must support DAS (e.g. Helius).
  CNFT_MERKLE_TREE: Env.schema.string.optional(),
  CNFT_METADATA_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  CNFT_METADATA_IMAGE_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  CNFT_ACADEMIC_PERIOD: Env.schema.string.optional(),

  // School score leaderboard POC (oracle-gated PDAs on Devnet)
  LEADERBOARD_PROGRAM_ID: Env.schema.string.optional(),
  LEADERBOARD_ORACLE_SECRET: Env.schema.string.optional(),

  // SAS attestation POC (backend oracle as authorized signer)
  SAS_ENABLED: Env.schema.string.optional(),
  SAS_CREDENTIAL_NAME: Env.schema.string.optional(),
  SAS_SCHEMA_NAME: Env.schema.string.optional(),
  SAS_SCHEMA_VERSION: Env.schema.number.optional(),
  SAS_CREDENTIAL_PDA: Env.schema.string.optional(),
  SAS_SCHEMA_PDA: Env.schema.string.optional(),
  SAS_MILESTONE_SCHEMA_NAME: Env.schema.string.optional(),
  SAS_MILESTONE_SCHEMA_VERSION: Env.schema.number.optional(),
  SAS_MILESTONE_SCHEMA_PDA: Env.schema.string.optional(),
  SAS_AUTHORITY_SECRET: Env.schema.string.optional(),
  SAS_AUTHORIZED_SIGNER_SECRET: Env.schema.string.optional(),
  SAS_ATTESTATION_EXPIRY_DAYS: Env.schema.number.optional(),

  // Google Classroom integration
  GOOGLE_CLIENT_ID: Env.schema.string.optional(),
  GOOGLE_CLIENT_SECRET: Env.schema.string.optional(),
  GOOGLE_REDIRECT_URI: Env.schema.string.optional({ format: 'url', tld: false }),
  GOOGLE_OAUTH_SCOPES: Env.schema.string.optional(),
  INTEGRATION_TOKEN_ENCRYPTION_KEY: Env.schema.string.optional(),
  FRONTEND_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  GOOGLE_CLASSROOM_MOCK: Env.schema.string.optional(),
  CLASSROOM_STUDENT_DEFAULT_PASSWORD: Env.schema.string.optional(),
  CLASSROOM_NIGHTLY_SYNC_CRON: Env.schema.string.optional(),
  CLASSROOM_NIGHTLY_SYNC_TIMEZONE: Env.schema.string.optional(),

  // Partner documentation portal (/partner/docs)
  PARTNER_DOCS_USERNAME: Env.schema.string.optional(),
  PARTNER_DOCS_PASSWORD: Env.schema.string.optional(),

  // Variables for configuring @adonisjs/queue
  QUEUE_DRIVER: Env.schema.enum.optional(['redis', 'database', 'sync'] as const),

  // DB (validated when using pg in config)
  DB_HOST: Env.schema.string.optional(),
  DB_PORT: Env.schema.number.optional(),
  DB_USER: Env.schema.string.optional(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string.optional(),
})
