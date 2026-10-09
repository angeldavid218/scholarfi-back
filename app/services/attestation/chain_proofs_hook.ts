import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import SubmissionChainProof from '#models/submission_chain_proof'
import { hashToHex, submissionHash } from '#services/attestation/hashes'
import { createSasConnection } from '#services/attestation/sas_attestation_client'
import { recordScoreForSubmission } from '#services/leaderboard/leaderboard_score_service'

export type MaybeRecordLeaderboardParams = {
  institutionId: number
  studentId: number
  submissionId: number
  points: number
  studentWalletPublicKey: string | null | undefined
  mintStatus: string
}

/**
 * Best-effort leaderboard record_score after a confirmed mint.
 * SAS milestone attestations run off-path (see sas:attest-milestones).
 * Never throws into the reward/approval path.
 */
export async function maybeRecordLeaderboardAfterMint(
  params: MaybeRecordLeaderboardParams
): Promise<void> {
  if (params.mintStatus !== 'confirmed') {
    return
  }
  if (!params.studentWalletPublicKey) {
    logger.warn(
      { submissionId: params.submissionId },
      'Leaderboard hook skipped: student wallet missing after mint'
    )
    return
  }

  try {
    const existing = await SubmissionChainProof.query()
      .where('submission_id', params.submissionId)
      .first()

    if (existing?.leaderboardSignature) {
      return
    }

    const subHash = submissionHash(params.submissionId)
    const subHashHex = hashToHex(subHash)

    const proof =
      existing ??
      (await SubmissionChainProof.create({
        submissionId: params.submissionId,
        submissionHash: subHashHex,
        status: 'pending',
      }))

    if (proof.submissionHash !== subHashHex) {
      proof.submissionHash = subHashHex
    }

    try {
      const connection = createSasConnection()
      const scored = await recordScoreForSubmission({
        connection,
        institutionId: params.institutionId,
        submissionHash: subHash,
        points: params.points,
        studentWallet: params.studentWalletPublicKey,
      })
      proof.schoolBoardPda = scored.schoolBoardPda
      proof.processedAchievementPda = scored.processedAchievementPda
      proof.studentScorePda = scored.studentScorePda
      proof.leaderboardSignature = scored.signature ?? (scored.alreadyProcessed ? 'existing' : null)
      proof.status = proof.leaderboardSignature ? 'scored' : 'failed'
      proof.errorMessage = null
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      proof.errorMessage = `leaderboard: ${msg}`
      proof.status = 'failed'
      logger.error(
        { err: error, submissionId: params.submissionId },
        'Leaderboard record_score failed (reward still confirmed)'
      )
    }

    await proof.save()
  } catch (error) {
    logger.error(
      { err: error, submissionId: params.submissionId },
      'Leaderboard chain proof hook failed (reward still confirmed)'
    )
  }
}

/** @deprecated Use maybeRecordLeaderboardAfterMint — SAS no longer runs on the mint path. */
export const maybeIssueChainProofsAfterMint = maybeRecordLeaderboardAfterMint

/** Resolve wallet after mint — prefers ledger wallet, then user row. */
export async function resolveStudentWalletAfterMint(
  studentId: number,
  ledgerWallet: string | null | undefined
): Promise<string | null> {
  if (ledgerWallet) {
    return ledgerWallet
  }
  const user = await User.find(studentId)
  return user?.walletPublicKey ?? null
}
