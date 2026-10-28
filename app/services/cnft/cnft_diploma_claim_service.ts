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
export async function claimDiplomaForProcessing(
  id: number,
  maxAttempts: number = 3
): Promise<ClaimedDiploma | null> {
  const eligibleStatuses = ['pending', 'failed']

  const result = await db.rawQuery(
    `
    UPDATE student_diploma_mints
    SET status = 'processing',
        attempts = attempts + 1,
        last_attempt_at = NOW()
    WHERE id = ?
      AND status IN (${eligibleStatuses.map(() => '?').join(',')})
      AND attempts < ?
    RETURNING id, institution_id, student_id, kind, rank, points, display_name,
              asset_id, merkle_tree, leaf_index, signature, metadata_uri, status, attempts
    `,
    [id, ...eligibleStatuses, maxAttempts]
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
 * Mark a diploma as needs_review for manual intervention.
 */
export async function markDiplomaNeedsReview(id: number, reason: string): Promise<void> {
  await db.from('student_diploma_mints').where('id', id).update({
    status: 'needs_review',
    error_message: reason,
    updated_at: DateTime.now().toSQL(),
  })
}

/**
 * Check if a diploma asset exists on-chain to recover from stale 'processing' status.
 * Verifies via DAS getAsset (if assetId) or checks signature status.
 * If found on-chain, mark confirmed. If not found after stale timeout, mark needs_review.
 */
export async function recoverStaleDiploma(id: number): Promise<void> {
  const row = await StudentDiplomaMint.find(id)
  if (!row) {
    logger.warn({ id }, 'Cannot recover stale diploma: row missing')
    return
  }

  try {
    if (row.assetId) {
      const { getAsset } = await import('#services/cnft/cnft_funciones')
      const asset = await getAsset(row.assetId)
      if (asset) {
        logger.info({ id, assetId: row.assetId }, 'Asset found on-chain, marking confirmed')
        await db.from('student_diploma_mints').where('id', id).update({
          status: 'confirmed',
          updated_at: DateTime.now().toSQL(),
        })
        return
      }
    }

    if (row.signature) {
      const { getSignatureStatuses } = await import('#services/cnft/cnft_funciones')
      const statuses = await getSignatureStatuses([row.signature])
      if (statuses && statuses[0]?.confirmationStatus) {
        logger.info(
          { id, signature: row.signature, status: statuses[0] },
          'Transaction confirmed on-chain'
        )
        await db.from('student_diploma_mints').where('id', id).update({
          status: 'confirmed',
          updated_at: DateTime.now().toSQL(),
        })
        return
      }
    }

    logger.warn({ id }, 'No on-chain confirmation found, marking needs_review')
    await markDiplomaNeedsReview(
      id,
      'Recovery: no on-chain confirmation after stale timeout (assetId/signature not found)'
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error({ err: error, id }, 'Stale diploma recovery error')
    await markDiplomaNeedsReview(id, `Recovery error: ${message}`)
  }
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

  const rows = await query.select(
    'id',
    'institution_id as institutionId',
    'student_id as studentId',
    'kind',
    'rank',
    'points',
    'display_name as displayName',
    'asset_id as assetId',
    'merkle_tree as merkleTree',
    'leaf_index as leafIndex',
    'signature',
    'metadata_uri as metadataUri',
    'status',
    'attempts'
  )

  return rows as ClaimedDiploma[]
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
