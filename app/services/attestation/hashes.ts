import { createHash } from 'node:crypto'
import { Keypair, PublicKey } from '@solana/web3.js'

/** Canonical 32-byte hash linking off-chain submission ↔ SAS ↔ leaderboard. */
export function submissionHash(submissionId: number | string): Buffer {
  return createHash('sha256').update(`scholarfi:submission:${submissionId}`).digest()
}

export function taskHash(taskId: number | string): Buffer {
  return createHash('sha256').update(`scholarfi:task:${taskId}`).digest()
}

/** Unique nonce pubkey per achievement (not the student wallet). */
export function nonceFromSubmissionHash(hash: Buffer): PublicKey {
  if (hash.length !== 32) {
    throw new Error('submission_hash must be 32 bytes')
  }
  return Keypair.fromSeed(hash).publicKey
}

export function hashToHex(hash: Buffer): string {
  return hash.toString('hex')
}

export function hexToHash(hex: string): Buffer {
  const cleaned = hex.replace(/^0x/, '')
  if (!/^[0-9a-fA-F]{64}$/.test(cleaned)) {
    throw new Error('hash must be 32 bytes as 64 hex chars')
  }
  return Buffer.from(cleaned, 'hex')
}
