import db from '@adonisjs/lucid/services/db'
import {
  debitInstitutionPoolForReward,
  linkCreditEntryToTokenTransaction,
} from '#services/credits/institution_credit_pool_service'
import type { DbTransaction } from '#services/credits/types'
import { InsufficientInstitutionCreditsError } from '#services/credits/types'
import {
  isInstitutionOnChainExecution,
  makeTokenServiceForInstitution,
} from '#services/tokens/factory'

export interface IssueRewardParams {
  institutionId: number
  studentId: number
  amount: number
  submissionId: number
  actorUserId?: number | null
  client?: DbTransaction
}

export interface IssueRewardResult {
  transactionId: number
  amount: number
  status: 'confirmed' | 'failed' | 'pending'
  transactionSignature: string | null
  idempotent: boolean
  institutionCreditEntryId: number | null
  executionProvider: 'mock' | 'solana' | string // temporary until we have a proper execution provider
}

/**
 * Orchestrates institution pool debit (simulated budget) + student credit execution.
 * Mock mode: DB ledger only. Devnet: same pool rules + on-chain mint when enabled.
 */
export async function issueRewardForSubmission(
  params: IssueRewardParams
): Promise<IssueRewardResult> {
  const exec = async (trx: DbTransaction) => {
    const onChain = await isInstitutionOnChainExecution(params.institutionId, trx)
    const tokenService = await makeTokenServiceForInstitution(params.institutionId, trx)

    const poolDebit = await debitInstitutionPoolForReward({
      institutionId: params.institutionId,
      studentId: params.studentId,
      amount: params.amount,
      submissionId: params.submissionId,
      actorUserId: params.actorUserId,
      client: trx,
    })

    const minted = await tokenService.mintTokens({
      userId: params.studentId,
      institutionId: params.institutionId,
      amount: params.amount,
      achievementId: params.submissionId,
      client: trx,
    })

    if (poolDebit.creditEntryId && minted.transactionId) {
      await linkCreditEntryToTokenTransaction(poolDebit.creditEntryId, minted.transactionId, trx)
    }

    return {
      transactionId: minted.transactionId,
      amount: minted.amount,
      status: minted.status,
      transactionSignature: minted.transactionSignature,
      idempotent: (minted.idempotent ?? false) || poolDebit.idempotent,
      institutionCreditEntryId: poolDebit.creditEntryId,
      executionProvider: onChain ? 'solana' : 'mock',
    }
  }

  if (params.client) {
    return exec(params.client)
  }
  return db.transaction(exec)
}

export { InsufficientInstitutionCreditsError }
