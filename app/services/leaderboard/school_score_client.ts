import { createHash, randomBytes } from 'node:crypto'
import {
  type Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import bs58 from 'bs58'
import env from '#start/env'

const DEFAULT_PROGRAM_ID = '9H5oUgPiu6AZKP6BTwSZ2z7gQSCg3d1Gxmk6q3ZSK9yF'

const IX = {
  initialize: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),
  initSchool: Buffer.from([70, 61, 188, 227, 225, 174, 245, 71]),
  recordScore: Buffer.from([30, 181, 94, 137, 7, 160, 236, 158]),
} as const

export type SchoolBoardAccount = {
  institutionId: bigint
  nameHash: Buffer
  totalPoints: bigint
  achievementCount: bigint
  seasonId: bigint
  lastUpdated: bigint
  bump: number
}

export type GlobalConfigAccount = {
  authority: PublicKey
  oracle: PublicKey
  seasonId: bigint
  paused: boolean
  bump: number
}

export type ProcessedAchievementAccount = {
  submissionHash: Buffer
  school: PublicKey
  student: PublicKey
  points: bigint
  seasonId: bigint
  bump: number
}

export type StudentScoreAccount = {
  school: PublicKey
  student: PublicKey
  points: bigint
  contributionCount: bigint
  bump: number
}

function loadKeypairFromSecret(secret: string): Keypair {
  const trimmed = secret.trim()
  if (trimmed.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)))
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed))
}

export function loadLeaderboardOracleKeypair(): Keypair {
  const secret =
    (env.get('LEADERBOARD_ORACLE_SECRET') as string | undefined)?.trim() ||
    (env.get('MINT_AUTHORITY_SECRET') as string | undefined)?.trim() ||
    ''
  if (!secret) {
    throw new Error(
      'Set LEADERBOARD_ORACLE_SECRET (or MINT_AUTHORITY_SECRET as POC fallback) for school-score:devnet'
    )
  }
  return loadKeypairFromSecret(secret)
}

export function getLeaderboardProgramId(): PublicKey {
  const raw =
    (env.get('LEADERBOARD_PROGRAM_ID') as string | undefined)?.trim() || DEFAULT_PROGRAM_ID
  return new PublicKey(raw)
}

export function getSolanaRpcUrl(): string {
  const url = (env.get('SOLANA_RPC_URL') as string | undefined)?.trim()
  if (!url) {
    throw new Error('SOLANA_RPC_URL is required for school-score:devnet')
  }
  return url
}

export function explorerAddressUrl(address: string, cluster = 'devnet'): string {
  return `https://explorer.solana.com/address/${address}?cluster=${cluster}`
}

export function explorerTxUrl(signature: string, cluster = 'devnet'): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`
}

export function configPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('config')], programId)
}

export function schoolPda(
  programId: PublicKey,
  institutionId: bigint | number
): [PublicKey, number] {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64LE(BigInt(institutionId))
  return PublicKey.findProgramAddressSync([Buffer.from('school'), buf], programId)
}

export function processedPda(programId: PublicKey, submissionHash: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('processed'), submissionHash], programId)
}

export function studentScorePda(
  programId: PublicKey,
  schoolBoard: PublicKey,
  student: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('student'), schoolBoard.toBuffer(), student.toBuffer()],
    programId
  )
}

export function nameHashFromLabel(label: string): Buffer {
  return createHash('sha256').update(label).digest()
}

export function parseSubmissionHash(hexOrEmpty?: string): Buffer {
  if (!hexOrEmpty) {
    return randomBytes(32)
  }
  const hex = hexOrEmpty.replace(/^0x/, '')
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('--submission-hash must be 32 bytes as 64 hex chars')
  }
  return Buffer.from(hex, 'hex')
}

function u64le(value: bigint | number): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64LE(BigInt(value))
  return buf
}

function readU64le(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset)
}

function readI64le(buf: Buffer, offset: number): bigint {
  return buf.readBigInt64LE(offset)
}

export function decodeGlobalConfig(data: Buffer): GlobalConfigAccount {
  let o = 8
  const authority = new PublicKey(data.subarray(o, o + 32))
  o += 32
  const oracle = new PublicKey(data.subarray(o, o + 32))
  o += 32
  const seasonId = readU64le(data, o)
  o += 8
  const paused = data[o] === 1
  o += 1
  const bump = data[o]
  return { authority, oracle, seasonId, paused, bump }
}

export function decodeSchoolBoard(data: Buffer): SchoolBoardAccount {
  let o = 8
  const institutionId = readU64le(data, o)
  o += 8
  const nameHash = Buffer.from(data.subarray(o, o + 32))
  o += 32
  const totalPoints = readU64le(data, o)
  o += 8
  const achievementCount = readU64le(data, o)
  o += 8
  const seasonId = readU64le(data, o)
  o += 8
  const lastUpdated = readI64le(data, o)
  o += 8
  const bump = data[o]
  return {
    institutionId,
    nameHash,
    totalPoints,
    achievementCount,
    seasonId,
    lastUpdated,
    bump,
  }
}

export function decodeProcessedAchievement(data: Buffer): ProcessedAchievementAccount {
  let o = 8
  const submissionHash = Buffer.from(data.subarray(o, o + 32))
  o += 32
  const school = new PublicKey(data.subarray(o, o + 32))
  o += 32
  const student = new PublicKey(data.subarray(o, o + 32))
  o += 32
  const points = readU64le(data, o)
  o += 8
  const seasonId = readU64le(data, o)
  o += 8
  const bump = data[o]
  return { submissionHash, school, student, points, seasonId, bump }
}

export function decodeStudentScore(data: Buffer): StudentScoreAccount {
  let o = 8
  const school = new PublicKey(data.subarray(o, o + 32))
  o += 32
  const student = new PublicKey(data.subarray(o, o + 32))
  o += 32
  const points = readU64le(data, o)
  o += 8
  const contributionCount = readU64le(data, o)
  o += 8
  const bump = data[o]
  return { school, student, points, contributionCount, bump }
}

export async function accountExists(connection: Connection, address: PublicKey): Promise<boolean> {
  const info = await connection.getAccountInfo(address)
  return info !== null
}

export function buildInitializeIx(params: {
  programId: PublicKey
  globalConfig: PublicKey
  authority: PublicKey
  oracle: PublicKey
  payer: PublicKey
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: params.globalConfig, isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: true, isWritable: false },
      { pubkey: params.oracle, isSigner: false, isWritable: false },
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: IX.initialize,
  })
}

export function buildInitSchoolIx(params: {
  programId: PublicKey
  globalConfig: PublicKey
  schoolBoard: PublicKey
  oracle: PublicKey
  payer: PublicKey
  institutionId: bigint | number
  nameHash: Buffer
}): TransactionInstruction {
  const data = Buffer.concat([IX.initSchool, u64le(params.institutionId), params.nameHash])
  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: params.globalConfig, isSigner: false, isWritable: false },
      { pubkey: params.schoolBoard, isSigner: false, isWritable: true },
      { pubkey: params.oracle, isSigner: true, isWritable: false },
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

export function buildRecordScoreIx(params: {
  programId: PublicKey
  globalConfig: PublicKey
  schoolBoard: PublicKey
  processedAchievement: PublicKey
  studentScore: PublicKey
  oracle: PublicKey
  payer: PublicKey
  submissionHash: Buffer
  points: bigint | number
  student: PublicKey
}): TransactionInstruction {
  const data = Buffer.concat([
    IX.recordScore,
    params.submissionHash,
    u64le(params.points),
    params.student.toBuffer(),
  ])
  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: params.globalConfig, isSigner: false, isWritable: false },
      { pubkey: params.schoolBoard, isSigner: false, isWritable: true },
      { pubkey: params.processedAchievement, isSigner: false, isWritable: true },
      { pubkey: params.studentScore, isSigner: false, isWritable: true },
      { pubkey: params.oracle, isSigner: true, isWritable: false },
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

export async function sendIx(
  connection: Connection,
  payer: Keypair,
  ix: TransactionInstruction
): Promise<string> {
  const tx = new Transaction().add(ix)
  try {
    return await sendAndConfirmTransaction(connection, tx, [payer], {
      commitment: 'confirmed',
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('no record of a prior credit') || msg.includes('Attempt to debit')) {
      throw new Error(
        `${msg} — Fund the oracle wallet with SOL on Devnet: solana airdrop 2 ${payer.publicKey.toBase58()} --url devnet`
      )
    }
    throw error
  }
}
