import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type DbTransaction = TransactionClientContract

export type InstitutionCreditEntryType = 'platform_allocate' | 'reward_issue'

export interface InstitutionCreditPoolSummary {
  institutionId: number
  allocatedCredits: number
  utilizedCredits: number
  remainingCredits: number
}

export interface AllocateInstitutionCreditsParams {
  institutionId: number
  amount: number
  actorUserId: number
  notes?: string | null
  client?: DbTransaction
}

export interface IssueRewardCreditsParams {
  institutionId: number
  studentId: number
  amount: number
  submissionId: number
  actorUserId?: number | null
  client?: DbTransaction
}

export class InsufficientInstitutionCreditsError extends Error {
  readonly code = 'INSUFFICIENT_INSTITUTION_CREDITS' as const

  constructor(
    readonly institutionId: number,
    readonly requested: number,
    readonly remaining: number
  ) {
    super(
      `Institution ${institutionId} has ${remaining} credits remaining; ${requested} requested`
    )
    this.name = 'InsufficientInstitutionCreditsError'
  }
}
