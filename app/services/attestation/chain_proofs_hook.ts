import logger from '@adonisjs/core/services/logger'
import Submission from '#models/submission'
import User from '#models/user'
import SubmissionChainProof from '#models/submission_chain_proof'
import { hashToHex, submissionHash } from '#services/attestation/hashes'
import {
  createSasConnection,
  isSasEnabled,
} from '#services/attestation/sas_attestation_client'
import { issueAchievementAttestation } from '#services/attestation/sas_attestation_service'
import { recordScoreForSubmission } from '#services/leaderboard/leaderboard_score_service'

export type MaybeIssueChainProofsParams = {
  institutionId: number
  studentId: number
  submissionId: number
  points: number
  studentWalletPublicKey: string | null | undefined
  mintStatus: string
}

/**
 * Best-effort SAS attestation + leaderboard record_score after a confirmed mint.
 * Never throws into the reward/approval path.
 */
export async function maybeIssueChainProofsAfterMint(
  params: MaybeIssueChainProofsParams
): Promise<void> {
  if (!isSasEnabled()) {
    return
  }
  if (params.mintStatus !== 'confirmed') {
    return
  }
  if (!params.studentWalletPublicKey) {
    logger.warn(
      { submissionId: params.submissionId },
      'SAS hook skipped: student wallet missing after mint'
    )
    return
  }

  try {
    const existing = await SubmissionChainProof.query()
      .where('submission_id', params.submissionId)
      .first()

    if (existing?.attestationSignature && existing?.leaderboardSignature) {
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

    const submission = await Submission.find(params.submissionId)
    if (!submission) {
      throw new Error(`Submission ${params.submissionId} not found`)
    }

    const errors: string[] = []

    if (!proof.attestationPda || !proof.attestationSignature) {
      try {
        const attest = await issueAchievementAttestation({
          institutionId: params.institutionId,
          submissionId: params.submissionId,
          taskId: submission.taskId,
          points: params.points,
          studentWallet: params.studentWalletPublicKey,
        })
        proof.attestationPda = attest.attestationPda
        proof.attestationSignature = attest.attestationSignature ?? 'existing'
        proof.status = 'attested'
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        errors.push(`attestation: ${msg}`)
        logger.error(
          { err: error, submissionId: params.submissionId },
          'SAS attestation failed (reward still confirmed)'
        )
      }
    }

    if (!proof.leaderboardSignature) {
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
        proof.leaderboardSignature =
          scored.signature ?? (scored.alreadyProcessed ? 'existing' : null)
        if (proof.attestationPda && proof.leaderboardSignature) {
          proof.status = 'scored'
        } else if (proof.attestationPda) {
          proof.status = 'partial'
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        errors.push(`leaderboard: ${msg}`)
        logger.error(
          { err: error, submissionId: params.submissionId },
          'Leaderboard record_score failed (reward still confirmed)'
        )
        if (proof.attestationPda) {
          proof.status = 'partial'
        }
      }
    }

    if (errors.length > 0) {
      proof.errorMessage = errors.join(' | ')
      if (!proof.attestationPda && !proof.leaderboardSignature) {
        proof.status = 'failed'
      }
    } else {
      proof.errorMessage = null
    }

    await proof.save()
  } catch (error) {
    logger.error(
      { err: error, submissionId: params.submissionId },
      'SAS/leaderboard chain proof hook failed (reward still confirmed)'
    )
  }
}

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
