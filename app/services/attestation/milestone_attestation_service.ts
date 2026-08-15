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
  createSasConnection,
  isSasEnabled,
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
      description:
        'Completa y recibe recompensa por tus primeras 5 actividades.',
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
  status: 'attested' | 'already_attested' | 'skipped' | 'failed'
  attestationPda?: string
  attestationSignature?: string | null
  errorMessage?: string
}

/**
 * Issue the MVP milestone attestation when a student has ≥ 5 rewarded activities.
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

  const existing = await StudentAchievementAttestation.query()
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

  const achHash = achievementHash(achievementKey, params.studentId)
  const achHashHex = hashToHex(achHash)

  const row =
    existing ??
    (await StudentAchievementAttestation.create({
      studentId: params.studentId,
      institutionId: params.institutionId,
      achievementKey,
      threshold,
      achievementHash: achHashHex,
      status: 'pending',
    }))

  row.achievementHash = achHashHex
  row.threshold = threshold
  row.institutionId = params.institutionId

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

    return {
      studentId: params.studentId,
      institutionId: params.institutionId,
      achievementKey,
      title,
      rewardedCount,
      status: attest.created ? 'attested' : 'already_attested',
      attestationPda: attest.attestationPda,
      attestationSignature: attest.signature,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    row.status = 'failed'
    row.errorMessage = msg
    await row.save()
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
    return [await attestFirst5ActivitiesForStudent(params as { studentId: number; institutionId: number })]
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
