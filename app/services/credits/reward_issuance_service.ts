import db from '@adonisjs/lucid/services/db'
import {
  debitInstitutionPoolForReward,
  linkCreditEntryToTokenTransaction,
} from '#services/credits/institution_credit_pool_service'
import {
  debitTeacherPoolForReward,
  linkTeacherCreditEntryToTokenTransaction,
} from '#services/credits/teacher_credit_pool_service'
import type { DbTransaction, RewardFundingSource } from '#services/credits/types'
import {
  InsufficientInstitutionCreditsError,
  InsufficientTeacherCreditsError,
} from '#services/credits/types'
import {
  isInstitutionOnChainExecution,
  makeTokenServiceForInstitution,
} from '#services/tokens/factory'
import {
  maybeRecordLeaderboardAfterMint,
  resolveStudentWalletAfterMint,
} from '#services/attestation/chain_proofs_hook'

export interface IssueRewardParams {
  institutionId: number
  studentId: number
  amount: number
  submissionId: number
  actorUserId?: number | null
  fundingSource?: RewardFundingSource
  teacherId?: number | null
  client?: DbTransaction
}

export interface IssueRewardResult {
  transactionId: number
  amount: number
  status: 'confirmed' | 'failed' | 'pending'
  transactionSignature: string | null
  idempotent: boolean
  institutionCreditEntryId: number | null
  teacherCreditEntryId: number | null
  fundingSource: RewardFundingSource
  executionProvider: 'mock' | 'solana' | string
}

/**
 * Orchestrates pool debit (teacher or institution) + student credit execution.
 */
export async function issueRewardForSubmission(
  params: IssueRewardParams
): Promise<IssueRewardResult> {
  const fundingSource: RewardFundingSource = params.fundingSource ?? 'institution'

  const exec = async (trx: DbTransaction) => {
    const onChain = await isInstitutionOnChainExecution(params.institutionId, trx)
    const tokenService = await makeTokenServiceForInstitution(params.institutionId, trx)

    let institutionCreditEntryId: number | null = null
    let teacherCreditEntryId: number | null = null
    let idempotent = false

    if (fundingSource === 'teacher') {
      if (params.teacherId == null) {
        throw new Error('teacherId is required when fundingSource is teacher')
      }

      const poolDebit = await debitTeacherPoolForReward({
        institutionId: params.institutionId,
        studentId: params.studentId,
        amount: params.amount,
        submissionId: params.submissionId,
        actorUserId: params.actorUserId,
        teacherId: params.teacherId,
        client: trx,
      })
      teacherCreditEntryId = poolDebit.creditEntryId
      idempotent = poolDebit.idempotent
    } else {
      const poolDebit = await debitInstitutionPoolForReward({
        institutionId: params.institutionId,
        studentId: params.studentId,
        amount: params.amount,
        submissionId: params.submissionId,
        actorUserId: params.actorUserId,
        client: trx,
      })
      institutionCreditEntryId = poolDebit.creditEntryId
      idempotent = poolDebit.idempotent
    }

    const minted = await tokenService.mintTokens({
      userId: params.studentId,
      institutionId: params.institutionId,
      amount: params.amount,
      achievementId: params.submissionId,
      client: trx,
    })

    if (institutionCreditEntryId && minted.transactionId) {
      await linkCreditEntryToTokenTransaction(
        institutionCreditEntryId,
        minted.transactionId,
        trx
      )
    }

    if (teacherCreditEntryId && minted.transactionId) {
      await linkTeacherCreditEntryToTokenTransaction(
        teacherCreditEntryId,
        minted.transactionId,
        trx
      )
    }

    if (onChain && minted.status === 'confirmed') {
      const wallet = await resolveStudentWalletAfterMint(params.studentId, null)
      await maybeRecordLeaderboardAfterMint({
        institutionId: params.institutionId,
        studentId: params.studentId,
        submissionId: params.submissionId,
        points: params.amount,
        studentWalletPublicKey: wallet,
        mintStatus: minted.status,
      })
    }

    return {
      transactionId: minted.transactionId,
      amount: minted.amount,
      status: minted.status,
      transactionSignature: minted.transactionSignature,
      idempotent: (minted.idempotent ?? false) || idempotent,
      institutionCreditEntryId,
      teacherCreditEntryId,
      fundingSource,
      executionProvider: onChain ? 'solana' : 'mock',
    }
  }

  if (params.client) {
    return exec(params.client)
  }
  return db.transaction(exec)
}

export { InsufficientInstitutionCreditsError, InsufficientTeacherCreditsError }
