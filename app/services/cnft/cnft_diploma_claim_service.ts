import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import StudentDiplomaMint from '#models/student_diploma_mint'

export interface ClaimedDiploma {
  id: number
  institutionId: number
  studentId: number
  kind: string
  rank: number
  points: number
  displayName: string
  assetId: string | null
  merkleTree: string | null
  leafIndex: number | null
  signature: string | null
  metadataUri: string | null
  status: string
  attempts: number
}

/**
 * Atomically claim a single diploma record for minting.
 * Sets status='processing' only if status is in an eligible state.
 * Returns null if the row is already claimed or not found.
 */
export async function claimDiplomaForProcessing(id: number): Promise<ClaimedDiploma | null> {
  const eligibleStatuses = ['pending', 'failed']

  const result = await db.rawQuery(
    `
    UPDATE student_diploma_mints
    SET status = 'processing',
        attempts = attempts + 1,
        last_attempt_at = NOW()
    WHERE id = ?
      AND status IN (${eligibleStatuses.map(() => '?').join(',')})
    RETURNING id, institution_id, student_id, kind, rank, points, display_name,
              asset_id, merkle_tree, leaf_index, signature, metadata_uri, status, attempts
    `,
    [id, ...eligibleStatuses]
  )

  return (result.rows[0] as ClaimedDiploma | undefined) ?? null
}

/**
 * Mark a diploma as successfully minted.
 */
export async function markDiplomaSucceeded(
  id: number,
  assetId: string,
  leafIndex: number,
  signature: string
): Promise<void> {
  await db.from('student_diploma_mints').where('id', id).update({
    status: 'confirmed',
    asset_id: assetId,
    leaf_index: leafIndex,
    signature,
    error_message: null,
    updated_at: DateTime.now().toSQL(),
  })
}

/**
 * Mark a diploma as failed with an error message.
 */
export async function markDiplomaFailed(id: number, errorMessage: string): Promise<void> {
  await db.from('student_diploma_mints').where('id', id).update({
    status: 'failed',
    error_message: errorMessage,
    updated_at: DateTime.now().toSQL(),
  })
}

/**
 * Check if a diploma asset exists on-chain to recover from stale 'processing' status.
 * If it exists, update the DB to 'confirmed'. Otherwise, reset to 'failed'.
 */
export async function recoverStaleDiploma(id: number): Promise<void> {
  const row = await StudentDiplomaMint.find(id)
  if (!row) {
    logger.warn({ id }, 'Cannot recover stale diploma: row missing')
    return
  }

  if (row.assetId) {
    logger.info({ id, assetId: row.assetId }, 'Asset ID exists, marking confirmed')
    await db.from('student_diploma_mints').where('id', id).update({
      status: 'confirmed',
      updated_at: DateTime.now().toSQL(),
    })
    return
  }

  logger.warn({ id }, 'No asset ID, cannot verify on-chain, marking failed')
  await markDiplomaFailed(id, 'Recovery failed: no asset ID to verify')
}

/**
 * Find outstanding diplomas eligible for minting.
 * Includes 'pending' and 'failed' with attempts < maxAttempts.
 */
export async function findEligibleDiplomas(params: {
  institutionId?: number
  maxAttempts: number
  limit: number
}): Promise<ClaimedDiploma[]> {
  let query = db
    .from('student_diploma_mints')
    .whereIn('status', ['pending', 'failed'])
    .where('attempts', '<', params.maxAttempts)
    .orderBy('id', 'asc')
    .limit(params.limit)

  if (params.institutionId) {
    query = query.where('institution_id', params.institutionId)
  }

  return query.select('*')
}

/**
 * Find stale processing records (processing for > threshold minutes).
 */
export async function findStaleProcessingDiplomas(params: {
  thresholdMinutes: number
  limit: number
}): Promise<{ id: number }[]> {
  const cutoff = DateTime.now().minus({ minutes: params.thresholdMinutes }).toSQL()

  return db
    .from('student_diploma_mints')
    .where('status', 'processing')
    .where('last_attempt_at', '<', cutoff)
    .orderBy('id', 'asc')
    .limit(params.limit)
    .select('id')
}
