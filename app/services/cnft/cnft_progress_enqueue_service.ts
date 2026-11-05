import db from '@adonisjs/lucid/services/db'
import tokenConfig, { assertCnftMintConfig } from '#config/token'
import StudentDiplomaMint, {
  PROGRESS_ACADEMICO_DIPLOMA_KIND,
} from '#models/student_diploma_mint'
import User from '#models/user'
import { diplomaMetadataUri } from '#services/cnft/cnft_diploma_service'
import {
  isInstitutionOnChainExecution,
  makeTokenServiceForInstitution,
} from '#services/tokens/factory'

export interface EnqueueProgressResult {
  considered: number
  enqueued: number
  skippedExisting: number
  skippedNotOnChain: number
  skippedNoWallet: number
  skippedTree: number
}

interface ImprovingRow {
  institution_id: number
  student_id: number
  delta: string | number | null
  full_name: string | null
  email: string | null
  wallet_public_key: string | null
}

function displayNameFor(row: ImprovingRow): string {
  const fullName = typeof row.full_name === 'string' ? row.full_name.trim() : ''
  const email = typeof row.email === 'string' ? row.email : ''
  return (
    fullName ||
    (email.includes('@') ? email.split('@')[0] : email) ||
    `Estudiante #${row.student_id}`
  )
}

function pointsFromDelta(delta: string | number | null): number {
  if (delta === null || delta === undefined || delta === '') return 0
  const n = typeof delta === 'number' ? delta : Number(delta)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n))
}

/**
 * Insert pending Progreso Académico diploma rows for students classified as improving.
 * Does not mint on-chain — `cnft:mint-sweep` claims and mints pending rows.
 */
export async function enqueueProgressDiplomas(params: {
  institutionId?: number
  limit?: number
}): Promise<EnqueueProgressResult> {
  const result: EnqueueProgressResult = {
    considered: 0,
    enqueued: 0,
    skippedExisting: 0,
    skippedNotOnChain: 0,
    skippedNoWallet: 0,
    skippedTree: 0,
  }

  if (!tokenConfig.cnftMerkleTree) {
    result.skippedTree = 1
    return result
  }

  try {
    assertCnftMintConfig()
  } catch {
    result.skippedTree = 1
    return result
  }

  let query = db
    .from('student_grade_progress as sgp')
    .join('users as u', 'u.id', 'sgp.student_id')
    .where('sgp.category', 'improving')
    .orderBy('sgp.delta', 'desc')
    .select(
      'sgp.institution_id',
      'sgp.student_id',
      'sgp.delta',
      'u.full_name',
      'u.email',
      'u.wallet_public_key'
    )

  if (params.institutionId) {
    query = query.where('sgp.institution_id', params.institutionId)
  }

  if (params.limit && params.limit > 0) {
    query = query.limit(params.limit)
  }

  const rows = (await query) as ImprovingRow[]
  result.considered = rows.length

  const onChainCache = new Map<number, boolean>()

  for (const row of rows) {
    const existing = await StudentDiplomaMint.query()
      .where({
        institutionId: row.institution_id,
        studentId: row.student_id,
        kind: PROGRESS_ACADEMICO_DIPLOMA_KIND,
      })
      .first()

    if (existing) {
      result.skippedExisting++
      continue
    }

    let onChain = onChainCache.get(row.institution_id)
    if (onChain === undefined) {
      onChain = await isInstitutionOnChainExecution(row.institution_id)
      onChainCache.set(row.institution_id, onChain)
    }
    if (!onChain) {
      result.skippedNotOnChain++
      continue
    }

    const tokenService = await makeTokenServiceForInstitution(row.institution_id)
    await tokenService.createWallet(String(row.student_id))
    const student = await User.find(row.student_id)
    if (!student?.walletPublicKey) {
      result.skippedNoWallet++
      continue
    }

    const mint = new StudentDiplomaMint()
    mint.institutionId = row.institution_id
    mint.studentId = row.student_id
    mint.kind = PROGRESS_ACADEMICO_DIPLOMA_KIND
    mint.rank = 0
    mint.points = pointsFromDelta(row.delta)
    mint.displayName = displayNameFor(row)
    mint.status = 'pending'
    mint.errorMessage = null
    mint.merkleTree = tokenConfig.cnftMerkleTree
    mint.attempts = 0
    await mint.save()

    mint.metadataUri = diplomaMetadataUri(mint.id)
    await mint.save()

    result.enqueued++
  }

  return result
}
