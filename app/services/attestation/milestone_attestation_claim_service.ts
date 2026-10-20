import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import StudentAchievementAttestation from '#models/student_achievement_attestation'
import { createSasConnection } from '#services/attestation/sas_attestation_client'

export interface ClaimedAttestation {
  id: number
  studentId: number
  institutionId: number
  achievementKey: string
  threshold: number
  achievementHash: string
  status: string
  attestationPda: string | null
  attestationSignature: string | null
  attempts: number
}

/**
 * Atomically claim a single attestation record for processing.
 * Sets status='processing' only if status is in an eligible state.
 * Returns null if the row is already claimed or not found.
 */
export async function claimAttestationForProcessing(
  id: number,
  maxAttempts: number = 3
): Promise<ClaimedAttestation | null> {
  const eligibleStatuses = ['pending', 'failed']

  const result = await db.rawQuery(
    `
    UPDATE student_achievement_attestations
    SET status = 'processing',
        attempts = attempts + 1,
        last_attempt_at = NOW()
    WHERE id = ?
      AND status IN (${eligibleStatuses.map(() => '?').join(',')})
      AND attempts < ?
    RETURNING id, student_id, institution_id, achievement_key, threshold, 
              achievement_hash, status, attestation_pda, attestation_signature, attempts
    `,
    [id, ...eligibleStatuses, maxAttempts]
  )

  return (result.rows[0] as ClaimedAttestation | undefined) ?? null
}

/**
 * Mark an attestation as successfully attested.
 */
export async function markAttestationSucceeded(
  id: number,
  attestationPda: string,
  signature: string | null
): Promise<void> {
  await db
    .from('student_achievement_attestations')
    .where('id', id)
    .update({
      status: 'attested',
      attestation_pda: attestationPda,
      attestation_signature: signature ?? 'existing',
      error_message: null,
      updated_at: DateTime.now().toSQL(),
    })
}

/**
 * Mark an attestation as failed with an error message.
 */
export async function markAttestationFailed(id: number, errorMessage: string): Promise<void> {
  await db.from('student_achievement_attestations').where('id', id).update({
    status: 'failed',
    error_message: errorMessage,
    updated_at: DateTime.now().toSQL(),
  })
}

/**
 * Mark an attestation as needs_review for manual intervention.
 */
export async function markAttestationNeedsReview(id: number, reason: string): Promise<void> {
  await db.from('student_achievement_attestations').where('id', id).update({
    status: 'needs_review',
    error_message: reason,
    updated_at: DateTime.now().toSQL(),
  })
}

/**
 * Check if an attestation PDA exists on-chain to recover from stale 'processing' status.
 * Derives PDA from credential/schema/achievement hash and checks getAccountInfo.
 * If it exists, mark attested. If not found after a retry, mark needs_review.
 */
export async function recoverStaleAttestation(id: number): Promise<void> {
  const row = await StudentAchievementAttestation.find(id)
  if (!row) {
    logger.warn({ id }, 'Cannot recover stale attestation: row missing')
    return
  }

  if (!row.attestationPda || !row.achievementHash) {
    logger.warn({ id }, 'Cannot recover stale attestation: missing PDA or hash')
    await markAttestationNeedsReview(id, 'Recovery: missing PDA or achievement hash')
    return
  }

  try {
    const connection = createSasConnection()
    const { PublicKey } = await import('@solana/web3.js')
    const pdaKey = new PublicKey(row.attestationPda)

    const accountInfo = await connection.getAccountInfo(pdaKey)
    if (accountInfo) {
      logger.info({ id, pda: row.attestationPda }, 'On-chain PDA found, marking attested')
      await markAttestationSucceeded(id, row.attestationPda, row.attestationSignature)
    } else {
      logger.warn({ id, pda: row.attestationPda }, 'On-chain PDA not found, needs manual review')
      await markAttestationNeedsReview(id, 'Recovery: PDA not found on-chain after stale timeout')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error({ err: error, id }, 'Stale attestation recovery failed')
    await markAttestationNeedsReview(id, `Recovery error: ${message}`)
  }
}

/**
 * Find eligible attestations for sweep processing.
 * Includes 'pending' and 'failed' with attempts < maxAttempts.
 */
export async function findEligibleAttestations(params: {
  institutionId?: number
  achievementKey: string
  maxAttempts: number
  limit: number
}): Promise<ClaimedAttestation[]> {
  let query = db
    .from('student_achievement_attestations')
    .whereIn('status', ['pending', 'failed'])
    .where('achievement_key', params.achievementKey)
    .where('attempts', '<', params.maxAttempts)
    .orderBy('id', 'asc')
    .limit(params.limit)

  if (params.institutionId) {
    query = query.where('institution_id', params.institutionId)
  }

  const rows = await query.select(
    'id',
    'student_id as studentId',
    'institution_id as institutionId',
    'achievement_key as achievementKey',
    'threshold',
    'achievement_hash as achievementHash',
    'status',
    'attestation_pda as attestationPda',
    'attestation_signature as attestationSignature',
    'attempts'
  )

  return rows as ClaimedAttestation[]
}

/**
 * Find stale processing records (processing for > threshold minutes).
 */
export async function findStaleProcessingAttestations(params: {
  thresholdMinutes: number
  limit: number
}): Promise<{ id: number }[]> {
  const cutoff = DateTime.now().minus({ minutes: params.thresholdMinutes }).toSQL()

  return db
    .from('student_achievement_attestations')
    .where('status', 'processing')
    .where('last_attempt_at', '<', cutoff)
    .orderBy('id', 'asc')
    .limit(params.limit)
    .select('id')
}
