import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import bs58 from 'bs58'
import env from '#start/env'
import { getSolanaRpcUrl } from '#services/leaderboard/school_score_client'
import {
  deserializeAttestationData,
  deriveAttestationPda,
  deriveCredentialPda,
  deriveSchemaPda,
  getAttestationDecoder,
  getCreateAttestationInstruction,
  getCreateCredentialInstruction,
  getCreateSchemaInstruction,
  getSchemaDecoder,
  serializeAttestationData,
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS,
  createKeyPairSignerFromBytes,
  type Schema,
} from '#services/attestation/sas_sdk'
import { nonceFromSubmissionHash } from '#services/attestation/hashes'

/** U64, VecU8, VecU8, U64, I64, U64 */
export const ACHIEVEMENT_SCHEMA_LAYOUT = Uint8Array.from([3, 13, 13, 3, 8, 3])

export const ACHIEVEMENT_SCHEMA_FIELDS = [
  'institution_id',
  'submission_hash',
  'task_hash',
  'points',
  'issued_at',
  'season_id',
] as const

export type AchievementAttestationData = {
  institution_id: bigint
  submission_hash: number[]
  task_hash: number[]
  points: bigint
  issued_at: bigint
  season_id: bigint
}

type KitInstruction = {
  programAddress: string
  data: Uint8Array | number[]
  accounts: Array<{
    address: string
    role: number
  }>
}

function loadKeypairFromSecret(secret: string): Keypair {
  const trimmed = secret.trim()
  if (trimmed.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)))
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed))
}

export function isSasEnabled(): boolean {
  const raw = (env.get('SAS_ENABLED') as string | undefined)?.trim().toLowerCase()
  return raw === 'true' || raw === '1' || raw === 'yes'
}

export function getSasCredentialName(): string {
  return (env.get('SAS_CREDENTIAL_NAME') as string | undefined)?.trim() || 'ScholarFi'
}

export function getSasSchemaName(): string {
  return (env.get('SAS_SCHEMA_NAME') as string | undefined)?.trim() || 'scholarfi.achievement.v1'
}

export function getSasSchemaVersion(): number {
  const v = env.get('SAS_SCHEMA_VERSION') as number | undefined
  return typeof v === 'number' && Number.isFinite(v) ? v : 1
}

export function getSasExpiryDays(): number {
  const v = env.get('SAS_ATTESTATION_EXPIRY_DAYS') as number | undefined
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 365
}

export function loadSasAuthorizedSignerKeypair(): Keypair {
  const secret =
    (env.get('SAS_AUTHORIZED_SIGNER_SECRET') as string | undefined)?.trim() ||
    (env.get('LEADERBOARD_ORACLE_SECRET') as string | undefined)?.trim() ||
    (env.get('MINT_AUTHORITY_SECRET') as string | undefined)?.trim() ||
    ''
  if (!secret) {
    throw new Error(
      'Set SAS_AUTHORIZED_SIGNER_SECRET (or LEADERBOARD_ORACLE_SECRET / MINT_AUTHORITY_SECRET)'
    )
  }
  return loadKeypairFromSecret(secret)
}

export function loadSasAuthorityKeypair(): Keypair {
  const secret = (env.get('SAS_AUTHORITY_SECRET') as string | undefined)?.trim()
  if (secret) {
    return loadKeypairFromSecret(secret)
  }
  return loadSasAuthorizedSignerKeypair()
}

export async function toTransactionSigner(keypair: Keypair) {
  return createKeyPairSignerFromBytes(keypair.secretKey)
}

function kitIxToWeb3(ix: KitInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programAddress),
    data: Buffer.from(ix.data),
    keys: ix.accounts.map((account) => ({
      pubkey: new PublicKey(account.address),
      isWritable: account.role === 1 || account.role === 3,
      isSigner: account.role === 2 || account.role === 3,
    })),
  })
}

export async function sendKitInstruction(
  connection: Connection,
  payers: Keypair[],
  kitIx: KitInstruction
): Promise<string> {
  const tx = new Transaction().add(kitIxToWeb3(kitIx))
  try {
    return await sendAndConfirmTransaction(connection, tx, payers, {
      commitment: 'confirmed',
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('no record of a prior credit') || msg.includes('Attempt to debit')) {
      throw new Error(
        `${msg} — Fund the payer with SOL on Devnet: solana airdrop 2 ${payers[0].publicKey.toBase58()} --url devnet`
      )
    }
    throw error
  }
}

export function createSasConnection(): Connection {
  return new Connection(getSolanaRpcUrl(), 'confirmed')
}

export async function resolveCredentialPda(authority: Keypair, name = getSasCredentialName()) {
  const pinned = (env.get('SAS_CREDENTIAL_PDA') as string | undefined)?.trim()
  if (pinned) {
    return pinned
  }
  const signer = await toTransactionSigner(authority)
  const [pda] = await deriveCredentialPda({ authority: signer.address, name })
  return pda
}

export async function resolveSchemaPda(
  credentialPda: string,
  name = getSasSchemaName(),
  version = getSasSchemaVersion()
) {
  const pinned = (env.get('SAS_SCHEMA_PDA') as string | undefined)?.trim()
  if (pinned) {
    return pinned
  }
  const [pda] = await deriveSchemaPda({ credential: credentialPda, name, version })
  return pda
}

export async function accountExists(connection: Connection, address: string): Promise<boolean> {
  const info = await connection.getAccountInfo(new PublicKey(address))
  return info !== null
}

export async function createCredentialIfNeeded(params: {
  connection: Connection
  authority: Keypair
  authorizedSigner: Keypair
  name?: string
}): Promise<{ credentialPda: string; signature: string | null; created: boolean }> {
  const name = params.name ?? getSasCredentialName()
  const authoritySigner = await toTransactionSigner(params.authority)
  const [credentialPda] = await deriveCredentialPda({
    authority: authoritySigner.address,
    name,
  })

  if (await accountExists(params.connection, credentialPda)) {
    return { credentialPda, signature: null, created: false }
  }

  const authorizedSigner = await toTransactionSigner(params.authorizedSigner)
  const ix = getCreateCredentialInstruction({
    payer: authoritySigner,
    authority: authoritySigner,
    credential: credentialPda,
    name,
    signers: [authorizedSigner.address],
  }) as KitInstruction

  const signature = await sendKitInstruction(params.connection, [params.authority], ix)
  return { credentialPda, signature, created: true }
}

export async function createSchemaIfNeeded(params: {
  connection: Connection
  authority: Keypair
  credentialPda: string
  name?: string
  version?: number
}): Promise<{ schemaPda: string; signature: string | null; created: boolean }> {
  const name = params.name ?? getSasSchemaName()
  const version = params.version ?? getSasSchemaVersion()
  const [schemaPda] = await deriveSchemaPda({
    credential: params.credentialPda,
    name,
    version,
  })

  if (await accountExists(params.connection, schemaPda)) {
    return { schemaPda, signature: null, created: false }
  }

  const authoritySigner = await toTransactionSigner(params.authority)
  const ix = getCreateSchemaInstruction({
    payer: authoritySigner,
    authority: authoritySigner,
    credential: params.credentialPda,
    schema: schemaPda,
    name,
    description: 'ScholarFi approved academic achievement (v1)',
    layout: ACHIEVEMENT_SCHEMA_LAYOUT,
    fieldNames: [...ACHIEVEMENT_SCHEMA_FIELDS],
  }) as KitInstruction

  const signature = await sendKitInstruction(params.connection, [params.authority], ix)
  return { schemaPda, signature, created: true }
}

export async function fetchSchemaAccount(
  connection: Connection,
  schemaPda: string
): Promise<Schema> {
  const info = await connection.getAccountInfo(new PublicKey(schemaPda))
  if (!info) {
    throw new Error(`Schema account not found: ${schemaPda}`)
  }
  return getSchemaDecoder().decode(info.data) as Schema
}

export function buildAchievementData(params: {
  institutionId: number
  submissionHash: Buffer
  taskHash: Buffer
  points: number
  issuedAt: number
  seasonId: number | bigint
}): AchievementAttestationData {
  return {
    institution_id: BigInt(params.institutionId),
    submission_hash: Array.from(params.submissionHash),
    task_hash: Array.from(params.taskHash),
    points: BigInt(params.points),
    issued_at: BigInt(params.issuedAt),
    season_id: BigInt(params.seasonId),
  }
}

export async function createAchievementAttestation(params: {
  connection: Connection
  authorizedSigner: Keypair
  credentialPda: string
  schemaPda: string
  submissionHash: Buffer
  data: AchievementAttestationData
  expiryUnix?: number
}): Promise<{
  attestationPda: string
  nonce: string
  signature: string | null
  created: boolean
}> {
  const noncePk = nonceFromSubmissionHash(params.submissionHash)
  const nonce = noncePk.toBase58()
  const [attestationPda] = await deriveAttestationPda({
    credential: params.credentialPda,
    schema: params.schemaPda,
    nonce,
  })

  if (await accountExists(params.connection, attestationPda)) {
    return { attestationPda, nonce, signature: null, created: false }
  }

  const schema = await fetchSchemaAccount(params.connection, params.schemaPda)
  const dataBytes = serializeAttestationData(schema, params.data as Record<string, unknown>)
  const expiry =
    params.expiryUnix ??
    Math.floor(Date.now() / 1000) + getSasExpiryDays() * 24 * 60 * 60

  const signer = await toTransactionSigner(params.authorizedSigner)
  const ix = getCreateAttestationInstruction({
    payer: signer,
    authority: signer,
    credential: params.credentialPda,
    schema: params.schemaPda,
    attestation: attestationPda,
    nonce,
    data: dataBytes,
    expiry,
  }) as KitInstruction

  const signature = await sendKitInstruction(params.connection, [params.authorizedSigner], ix)
  return { attestationPda, nonce, signature, created: true }
}

export async function fetchAndDecodeAchievementAttestation(params: {
  connection: Connection
  attestationPda: string
  schemaPda: string
}): Promise<AchievementAttestationData> {
  const [attInfo, schema] = await Promise.all([
    params.connection.getAccountInfo(new PublicKey(params.attestationPda)),
    fetchSchemaAccount(params.connection, params.schemaPda),
  ])
  if (!attInfo) {
    throw new Error(`Attestation account not found: ${params.attestationPda}`)
  }
  const attestation = getAttestationDecoder().decode(attInfo.data) as { data: Uint8Array }
  return deserializeAttestationData(schema, Uint8Array.from(attestation.data)) as AchievementAttestationData
}

export function explorerAddressUrl(address: string, cluster = 'devnet'): string {
  return `https://explorer.solana.com/address/${address}?cluster=${cluster}`
}

export function explorerTxUrl(signature: string, cluster = 'devnet'): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`
}

export function sasProgramId(): string {
  return SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS
}
