import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type DbTransaction = TransactionClientContract

export type InstitutionCreditEntryType =
  | 'platform_allocate'
  | 'reward_issue'
  | 'teacher_delegate'

export type TeacherCreditEntryType = 'admin_allocate' | 'reward_issue'

export type RewardFundingSource = 'teacher' | 'institution'

export interface InstitutionCreditPoolSummary {
  institutionId: number
  allocatedCredits: number
  utilizedCredits: number
  remainingCredits: number
}

export interface InstitutionBudgetBreakdown {
  institutionId: number
  allocatedCredits: number
  utilizedCredits: number
  delegatedCredits: number
  availableToAssign: number
  teacherCount: number
}

export interface TeacherCreditPoolSummary {
  teacherId: number
  institutionId: number
  allocatedCredits: number
  utilizedCredits: number
  remainingCredits: number
  hasPool: boolean
  lastAllocationAt: string | null
}

export interface TeacherCreditPoolListItem extends TeacherCreditPoolSummary {
  email: string
  fullName: string | null
}

export interface AllocateInstitutionCreditsParams {
  institutionId: number
  amount: number
  actorUserId: number
  notes?: string | null
  client?: DbTransaction
}

export interface AllocateTeacherCreditsParams {
  institutionId: number
  teacherId: number
  amount: number
  actorUserId: number
  notes?: string | null
  client?: DbTransaction
}

export interface AllocateEqualTeacherCreditsParams {
  institutionId: number
  totalAmount: number
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
  fundingSource?: RewardFundingSource
  teacherId?: number | null
  client?: DbTransaction
}

/** Teacher pool debit requires a concrete teacher id. */
export interface IssueTeacherRewardCreditsParams {
  institutionId: number
  studentId: number
  amount: number
  submissionId: number
  teacherId: number
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

export class InsufficientTeacherCreditsError extends Error {
  readonly code = 'INSUFFICIENT_TEACHER_CREDITS' as const

  constructor(
    readonly teacherId: number,
    readonly requested: number,
    readonly remaining: number
  ) {
    super(`Teacher ${teacherId} has ${remaining} credits remaining; ${requested} requested`)
    this.name = 'InsufficientTeacherCreditsError'
  }
}

export class InsufficientInstitutionBudgetToAssignError extends Error {
  readonly code = 'INSUFFICIENT_INSTITUTION_BUDGET_TO_ASSIGN' as const

  constructor(
    readonly institutionId: number,
    readonly requested: number,
    readonly availableToAssign: number
  ) {
    super(
      `Institution ${institutionId} has ${availableToAssign} credits available to assign; ${requested} requested`
    )
    this.name = 'InsufficientInstitutionBudgetToAssignError'
  }
}
