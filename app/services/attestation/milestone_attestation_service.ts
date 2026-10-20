import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import StudentAchievementAttestation, {
  FIRST_5_ACTIVITIES_KEY,
  FIRST_5_ACTIVITIES_THRESHOLD,
  FIRST_5_ACTIVITIES_TITLE,
} from '#models/student_achievement_attestation'
import { achievementHash, hashToHex, studentIdHash } from '#services/attestation/hashes'
import {
  buildMilestoneData,
  createMilestoneAttestation,
  createMilestoneSchemaIfNeeded,
  createSasConnection,
  explorerTxUrl,
  isSasEnabled,
  loadSasAuthorityKeypair,
  loadSasAuthorizedSignerKeypair,
  resolveCredentialPda,
  resolveMilestoneSchemaPda,
} from '#services/attestation/sas_attestation_client'
import { getActiveSeasonId } from '#services/leaderboard/leaderboard_score_service'
import { isInstitutionOnChainExecution } from '#services/tokens/factory'

export { FIRST_5_ACTIVITIES_KEY, FIRST_5_ACTIVITIES_THRESHOLD, FIRST_5_ACTIVITIES_TITLE }

export async function countRewardedActivities(
  studentId: number,
  institutionId: number
): Promise<number> {
  const row = await db
    .from('token_transactions')
    .where({
      user_id: studentId,
      institution_id: institutionId,
      type: 'mint',
      status: 'confirmed',
    })
    .whereNotNull('achievement_id')
    .count('* as total')
    .first()

  return Number(row?.total ?? 0)
}

export type StudentAchievementView = {
  key: string
  title: string
  description: string
  threshold: number
  progress: number
  unlocked: boolean
  status: 'locked' | 'in_progress' | 'attested' | 'eligible' | 'failed'
  attestationPda: string | null
  attestationSignature: string | null
  explorerUrl: string | null
}

export type StudentAchievementsResponse = {
  institutionId: number
  rewardedCount: number
  achievements: StudentAchievementView[]
}

function explorerAttestationUrl(pda: string): string {
  return `https://explorer.solana.com/address/${pda}?cluster=devnet`
}

function studentDisplayName(
  fullName: string | null,
  email: string | null,
  studentId: number
): string {
  const name = typeof fullName === 'string' ? fullName.trim() : ''
  const mail = typeof email === 'string' ? email : ''
  return name || (mail.includes('@') ? mail.split('@')[0] : mail) || `Estudiante #${studentId}`
}

export type MilestoneCandidateView = {
  studentId: number
  displayName: string
  rewardedCount: number
  status: 'eligible' | 'attested' | 'failed' | 'pending'
  attestationPda: string | null
  attestationSignature: string | null
  explorerUrl: string | null
}

export type MilestoneAttestationPreview = {
  institutionId: number
  sasEnabled: boolean
  onChainEnabled: boolean
  milestoneTitle: string
  threshold: number
  achievementKey: string
  summary: {
    eligible: number
    attested: number
    failed: number
    pending: number
    total: number
  }
  candidates: MilestoneCandidateView[]
}

export type MilestoneSchemaEnsureResult = {
  schemaPda: string
  created: boolean
  signature: string | null
}

export type MilestoneAttestRunSummary = {
  attested: number
  alreadyAttested: number
  skipped: number
  failed: number
}

export type MilestoneAttestResultView = MilestoneAttestResult & {
  explorerUrl: string | null
  txExplorerUrl: string | null
}

/**
 * Ensure the milestone SAS schema exists (shared by CLI and admin API).
 */
export async function ensureMilestoneSchemaReady(): Promise<MilestoneSchemaEnsureResult> {
  const connection = createSasConnection()
  const authority = loadSasAuthorityKeypair()
  const signer = loadSasAuthorizedSignerKeypair()
  const credentialPda = await resolveCredentialPda(signer)
  const schema = await createMilestoneSchemaIfNeeded({
    connection,
    authority,
    credentialPda,
  })
  return {
    schemaPda: schema.schemaPda,
    created: schema.created,
    signature: schema.signature,
  }
}

/**
 * Students with enough rewarded activities for the first-5 milestone (admin preview).
 */
export async function listMilestoneCandidatesForInstitution(
  institutionId: number
): Promise<MilestoneCandidateView[]> {
  const rows = await db
    .from('token_transactions as tt')
    .join('users as u', 'u.id', 'tt.user_id')
    .leftJoin('student_achievement_attestations as saa', (join) => {
      join
        .on('saa.student_id', 'tt.user_id')
        .andOnVal('saa.achievement_key', FIRST_5_ACTIVITIES_KEY)
    })
    .where('tt.institution_id', institutionId)
    .where('tt.type', 'mint')
    .andWhere('tt.status', 'confirmed')
    .whereNotNull('tt.achievement_id')
    .groupBy(
      'tt.user_id',
      'u.full_name',
      'u.email',
      'saa.status',
      'saa.attestation_pda',
      'saa.attestation_signature'
    )
    .havingRaw('COUNT(*) >= ?', [FIRST_5_ACTIVITIES_THRESHOLD])
    .select('tt.user_id as student_id')
    .select(db.raw('COUNT(*)::int as rewarded_count'))
    .select('u.full_name', 'u.email')
    .select('saa.status as attestation_status', 'saa.attestation_pda', 'saa.attestation_signature')
    .orderBy('rewarded_count', 'desc')

  return rows.map((row) => {
    const studentId = Number(row.student_id)
    const rewardedCount = Number(row.rewarded_count ?? 0)
    const attestationStatus =
      typeof row.attestation_status === 'string' ? row.attestation_status : null
    const attestationPda = typeof row.attestation_pda === 'string' ? row.attestation_pda : null
    const attestationSignature =
      typeof row.attestation_signature === 'string' ? row.attestation_signature : null

    let status: MilestoneCandidateView['status'] = 'eligible'
    if (attestationStatus === 'attested' && attestationPda) {
      status = 'attested'
    } else if (attestationStatus === 'processing') {
      // Do not map processing to eligible, treat as pending
      status = 'pending'
    } else if (attestationStatus === 'failed') {
      status = 'failed'
    } else if (attestationStatus === 'pending') {
      status = 'pending'
    }

    return {
      studentId,
      displayName: studentDisplayName(
        typeof row.full_name === 'string' ? row.full_name : null,
        typeof row.email === 'string' ? row.email : null,
        studentId
      ),
      rewardedCount,
      status,
      attestationPda,
      attestationSignature,
      explorerUrl: attestationPda ? explorerAttestationUrl(attestationPda) : null,
    }
  })
}

export async function getMilestoneAttestationPreview(
  institutionId: number
): Promise<MilestoneAttestationPreview> {
  const [candidates, onChainEnabled] = await Promise.all([
    listMilestoneCandidatesForInstitution(institutionId),
    isInstitutionOnChainExecution(institutionId),
  ])

  const summary = {
    eligible: candidates.filter((c) => c.status === 'eligible').length,
    attested: candidates.filter((c) => c.status === 'attested').length,
    failed: candidates.filter((c) => c.status === 'failed').length,
    pending: candidates.filter((c) => c.status === 'pending').length,
    total: candidates.length,
  }

  return {
    institutionId,
    sasEnabled: isSasEnabled(),
    onChainEnabled,
    milestoneTitle: FIRST_5_ACTIVITIES_TITLE,
    threshold: FIRST_5_ACTIVITIES_THRESHOLD,
    achievementKey: FIRST_5_ACTIVITIES_KEY,
    summary,
    candidates,
  }
}

export function summarizeMilestoneAttestResults(
  results: MilestoneAttestResult[]
): MilestoneAttestRunSummary {
  return {
    attested: results.filter((r) => r.status === 'attested').length,
    alreadyAttested: results.filter((r) => r.status === 'already_attested').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
  }
}

export function toMilestoneAttestResultView(
  result: MilestoneAttestResult
): MilestoneAttestResultView {
  return {
    ...result,
    explorerUrl: result.attestationPda ? explorerAttestationUrl(result.attestationPda) : null,
    txExplorerUrl:
      result.attestationSignature && result.attestationSignature !== 'existing'
        ? explorerTxUrl(result.attestationSignature)
        : null,
  }
}

/**
 * Ensure milestone schema and batch-attest eligible students (admin API / demo).
 * Skips students already attested in DB so the run summary reflects this action only.
 */
export async function runMilestoneAttestationsForInstitution(params: {
  institutionId: number
  studentId?: number
  ensureSchema?: boolean
  limit?: number
}): Promise<{ results: MilestoneAttestResultView[]; summary: MilestoneAttestRunSummary }> {
  if (params.ensureSchema !== false) {
    await ensureMilestoneSchemaReady()
  }

  let results: MilestoneAttestResult[]

  if (params.studentId) {
    results = await attestFirst5MilestonesBatch({
      institutionId: params.institutionId,
      studentId: params.studentId,
      limit: params.limit,
    })
  } else {
    const candidates = await listMilestoneCandidatesForInstitution(params.institutionId)
    const pending = candidates.filter((c) => c.status !== 'attested')
    const limit = params.limit ?? 100
    results = []
    for (const candidate of pending.slice(0, limit)) {
      results.push(
        await attestFirst5ActivitiesForStudent({
          studentId: candidate.studentId,
          institutionId: params.institutionId,
        })
      )
    }
  }

  return {
    results: results.map(toMilestoneAttestResultView),
    summary: summarizeMilestoneAttestResults(results),
  }
}

/**
 * Progress + attestation status for the student's known MVP milestones (UI).
 */
export async function getStudentAchievementsForUi(params: {
  studentId: number
  institutionId: number
}): Promise<StudentAchievementsResponse> {
  const rewardedCount = await countRewardedActivities(params.studentId, params.institutionId)
  const row = await StudentAchievementAttestation.query()
    .where({
      studentId: params.studentId,
      achievementKey: FIRST_5_ACTIVITIES_KEY,
    })
    .first()

  const unlocked = Boolean(row?.attestationPda && row.status === 'attested')
  const progress = Math.min(rewardedCount, FIRST_5_ACTIVITIES_THRESHOLD)
  let status: StudentAchievementView['status'] = 'locked'
  if (unlocked) {
    status = 'attested'
  } else if (row?.status === 'failed') {
    status = 'failed'
  } else if (rewardedCount >= FIRST_5_ACTIVITIES_THRESHOLD) {
    status = 'eligible'
  } else if (rewardedCount > 0) {
    status = 'in_progress'
  }

  const achievements: StudentAchievementView[] = [
    {
      key: FIRST_5_ACTIVITIES_KEY,
      title: FIRST_5_ACTIVITIES_TITLE,
      description: 'Completa y recibe recompensa por tus primeras 2 actividades.',
      threshold: FIRST_5_ACTIVITIES_THRESHOLD,
      progress,
      unlocked,
      status,
      attestationPda: row?.attestationPda ?? null,
      attestationSignature: row?.attestationSignature ?? null,
      explorerUrl: row?.attestationPda ? explorerAttestationUrl(row.attestationPda) : null,
    },
  ]

  return {
    institutionId: params.institutionId,
    rewardedCount,
    achievements,
  }
}

export type MilestoneAttestResult = {
  studentId: number
  institutionId: number
  achievementKey: string
  title: string
  rewardedCount: number
  status: 'attested' | 'already_attested' | 'skipped' | 'failed' | 'in_progress'
  attestationPda?: string
  attestationSignature?: string | null
  errorMessage?: string
}

/**
 * Issue the MVP milestone attestation when a student has ≥ 2 rewarded activities.
 */
export async function attestFirst5ActivitiesForStudent(params: {
  studentId: number
  institutionId: number
}): Promise<MilestoneAttestResult> {
  const title = FIRST_5_ACTIVITIES_TITLE
  const achievementKey = FIRST_5_ACTIVITIES_KEY
  const threshold = FIRST_5_ACTIVITIES_THRESHOLD

  if (!isSasEnabled()) {
    return {
      studentId: params.studentId,
      institutionId: params.institutionId,
      achievementKey,
      title,
      rewardedCount: 0,
      status: 'skipped',
      errorMessage: 'SAS_ENABLED is not true',
    }
  }

  const onChain = await isInstitutionOnChainExecution(params.institutionId)
  if (!onChain) {
    return {
      studentId: params.studentId,
      institutionId: params.institutionId,
      achievementKey,
      title,
      rewardedCount: 0,
      status: 'skipped',
      errorMessage: 'Institution is not on-chain',
    }
  }

  const student = await User.find(params.studentId)
  if (!student?.walletPublicKey) {
    return {
      studentId: params.studentId,
      institutionId: params.institutionId,
      achievementKey,
      title,
      rewardedCount: 0,
      status: 'skipped',
      errorMessage: 'Student wallet missing',
    }
  }

  const rewardedCount = await countRewardedActivities(params.studentId, params.institutionId)
  if (rewardedCount < threshold) {
    return {
      studentId: params.studentId,
      institutionId: params.institutionId,
      achievementKey,
      title,
      rewardedCount,
      status: 'skipped',
      errorMessage: `Need ${threshold} rewarded activities (have ${rewardedCount})`,
    }
  }

  let existing = await StudentAchievementAttestation.query()
    .where({
      studentId: params.studentId,
      achievementKey,
    })
    .first()

  if (existing?.attestationPda && existing.status === 'attested') {
    return {
      studentId: params.studentId,
      institutionId: params.institutionId,
      achievementKey,
      title,
      rewardedCount,
      status: 'already_attested',
      attestationPda: existing.attestationPda,
      attestationSignature: existing.attestationSignature,
    }
  }

  // If record is currently processing, return in-progress status
  if (existing?.status === 'processing') {
    return {
      studentId: params.studentId,
      institutionId: params.institutionId,
      achievementKey,
      title,
      rewardedCount,
      status: 'in_progress',
      errorMessage: 'Attestation is currently being processed',
    }
  }

  const achHash = achievementHash(achievementKey, params.studentId)
  const achHashHex = hashToHex(achHash)

  if (!existing) {
    existing = await StudentAchievementAttestation.create({
      studentId: params.studentId,
      institutionId: params.institutionId,
      achievementKey,
      threshold,
      achievementHash: achHashHex,
      status: 'pending',
      attempts: 0,
    })
  }

  // Atomically claim the row for processing
  const { claimAttestationForProcessing } = await import(
    '#services/attestation/milestone_attestation_claim_service'
  )
  const claimed = await claimAttestationForProcessing(existing.id, 3)

  if (!claimed) {
    return {
      studentId: params.studentId,
      institutionId: params.institutionId,
      achievementKey,
      title,
      rewardedCount,
      status: 'in_progress',
      errorMessage: 'Unable to claim record (may be processing or max attempts reached)',
    }
  }

  const row = await StudentAchievementAttestation.findOrFail(existing.id)

  try {

    const connection = createSasConnection()
    const signer = loadSasAuthorizedSignerKeypair()
    const credentialPda = await resolveCredentialPda(signer)
    const schemaPda = await resolveMilestoneSchemaPda(credentialPda)
    const seasonId = await getActiveSeasonId(connection)

    const data = buildMilestoneData({
      institutionId: params.institutionId,
      studentHash: studentIdHash(params.studentId),
      achievementKey,
      threshold,
      issuedAt: Math.floor(Date.now() / 1000),
      seasonId,
    })

    const attest = await createMilestoneAttestation({
      connection,
      authorizedSigner: signer,
      credentialPda,
      schemaPda,
      achievementHash: achHash,
      data,
    })

    row.attestationPda = attest.attestationPda
    row.attestationSignature = attest.signature ?? 'existing'
    row.status = 'attested'
    row.errorMessage = null
    await row.save()

    // Count as attested whenever this run successfully records the attestation.
    // `already_attested` is reserved for the early DB short-circuit above; an
    // existing on-chain PDA with a missing/pending DB row is still a successful emit.
    return {
      studentId: params.studentId,
      institutionId: params.institutionId,
      achievementKey,
      title,
      rewardedCount,
      status: 'attested',
      attestationPda: attest.attestationPda,
      attestationSignature: attest.signature ?? row.attestationSignature,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    
    // Only mark as failed if still owned by this attempt (status=processing)
    await row.refresh()
    if (row.status === 'processing') {
      row.status = 'failed'
      row.errorMessage = msg
      await row.save()
    }

    logger.error(
      { err: error, studentId: params.studentId, achievementKey },
      'Milestone attestation failed'
    )
    return {
      studentId: params.studentId,
      institutionId: params.institutionId,
      achievementKey,
      title,
      rewardedCount,
      status: 'failed',
      errorMessage: msg,
    }
  }
}

/**
 * Scan students with enough confirmed mints and attest the first-5 milestone.
 */
export async function attestFirst5MilestonesBatch(params?: {
  institutionId?: number
  studentId?: number
  limit?: number
}): Promise<MilestoneAttestResult[]> {
  if (params?.studentId && params?.institutionId) {
    return [
      await attestFirst5ActivitiesForStudent(
        params as { studentId: number; institutionId: number }
      ),
    ]
  }

  if (params?.studentId) {
    const user = await User.findOrFail(params.studentId)
    if (!user.institutionId) {
      return [
        {
          studentId: params.studentId,
          institutionId: 0,
          achievementKey: FIRST_5_ACTIVITIES_KEY,
          title: FIRST_5_ACTIVITIES_TITLE,
          rewardedCount: 0,
          status: 'skipped',
          errorMessage: 'Student has no institution',
        },
      ]
    }
    return [
      await attestFirst5ActivitiesForStudent({
        studentId: params.studentId,
        institutionId: user.institutionId,
      }),
    ]
  }

  let query = db
    .from('token_transactions as tt')
    .join('users as u', 'u.id', 'tt.user_id')
    .where('tt.type', 'mint')
    .andWhere('tt.status', 'confirmed')
    .whereNotNull('tt.achievement_id')
    .groupBy('tt.user_id', 'tt.institution_id')
    .havingRaw('COUNT(*) >= ?', [FIRST_5_ACTIVITIES_THRESHOLD])
    .select('tt.user_id as student_id', 'tt.institution_id as institution_id')
    .select(db.raw('COUNT(*)::int as rewarded_count'))

  if (params?.institutionId) {
    query = query.andWhere('tt.institution_id', params.institutionId)
  }

  const limit = params?.limit ?? 100
  const candidates = await query.limit(limit)

  const results: MilestoneAttestResult[] = []
  for (const row of candidates) {
    results.push(
      await attestFirst5ActivitiesForStudent({
        studentId: Number(row.student_id),
        institutionId: Number(row.institution_id),
      })
    )
  }
  return results
}
