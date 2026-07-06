import db from '@adonisjs/lucid/services/db'
import type {
  AllocateInstitutionCreditsParams,
  DbTransaction,
  InstitutionCreditPoolSummary,
  IssueRewardCreditsParams,
} from '#services/credits/types'
import { InsufficientInstitutionCreditsError } from '#services/credits/types'

function tbl(name: string, trx?: DbTransaction) {
  const q = db.table(name)
  return trx ? q.useTransaction(trx) : q
}

function fromTbl(name: string, trx?: DbTransaction) {
  const q = db.from(name)
  return trx ? q.useTransaction(trx) : q
}

export async function ensureInstitutionCreditPool(
  institutionId: number,
  trx?: DbTransaction
): Promise<void> {
  await tbl('institution_credit_pools', trx)
    .insert({
      institution_id: institutionId,
      allocated_credits: 0,
      utilized_credits: 0,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflict('institution_id')
    .ignore()
}

export async function getInstitutionCreditPoolSummary(
  institutionId: number,
  trx?: DbTransaction
): Promise<InstitutionCreditPoolSummary> {
  await ensureInstitutionCreditPool(institutionId, trx)
  const row = await fromTbl('institution_credit_pools', trx)
    .where('institution_id', institutionId)
    .firstOrFail()

  const allocated = Number(row.allocated_credits)
  const utilized = Number(row.utilized_credits)

  return {
    institutionId,
    allocatedCredits: allocated,
    utilizedCredits: utilized,
    remainingCredits: allocated - utilized,
  }
}

export async function allocateInstitutionCredits(
  params: AllocateInstitutionCreditsParams
): Promise<InstitutionCreditPoolSummary> {
  const exec = async (trx: DbTransaction) => {
    if (params.amount <= 0) {
      throw new Error('Allocation amount must be positive')
    }

    await ensureInstitutionCreditPool(params.institutionId, trx)

    const pool = await fromTbl('institution_credit_pools', trx)
      .where('institution_id', params.institutionId)
      .forUpdate()
      .firstOrFail()

    const nextAllocated = Number(pool.allocated_credits) + params.amount

    await fromTbl('institution_credit_pools', trx)
      .where('institution_id', params.institutionId)
      .update({
        allocated_credits: nextAllocated,
        updated_at: new Date(),
      })

    await tbl('institution_credit_entries', trx).insert({
      institution_id: params.institutionId,
      entry_type: 'platform_allocate',
      amount: params.amount,
      submission_id: null,
      token_transaction_id: null,
      actor_user_id: params.actorUserId,
      notes: params.notes ?? null,
      created_at: new Date(),
    })

    return getInstitutionCreditPoolSummary(params.institutionId, trx)
  }

  if (params.client) {
    return exec(params.client)
  }
  return db.transaction(exec)
}

/**
 * Debits the institution pool when issuing a reward. Call before token execution.
 * Idempotent per submission: skips if a reward_issue entry already exists.
 */
export async function debitInstitutionPoolForReward(
  params: IssueRewardCreditsParams
): Promise<{ creditEntryId: number; idempotent: boolean }> {
  const exec = async (trx: DbTransaction) => {
    const existing = await fromTbl('institution_credit_entries', trx)
      .where({
        institution_id: params.institutionId,
        submission_id: params.submissionId,
        entry_type: 'reward_issue',
      })
      .first()

    if (existing) {
      return { creditEntryId: existing.id as number, idempotent: true }
    }

    await ensureInstitutionCreditPool(params.institutionId, trx)

    const pool = await fromTbl('institution_credit_pools', trx)
      .where('institution_id', params.institutionId)
      .forUpdate()
      .firstOrFail()

    const allocated = Number(pool.allocated_credits)
    const utilized = Number(pool.utilized_credits)
    const remaining = allocated - utilized

    if (remaining < params.amount) {
      throw new InsufficientInstitutionCreditsError(
        params.institutionId,
        params.amount,
        remaining
      )
    }

    await fromTbl('institution_credit_pools', trx)
      .where('institution_id', params.institutionId)
      .update({
        utilized_credits: utilized + params.amount,
        updated_at: new Date(),
      })

    const inserted = await tbl('institution_credit_entries', trx)
      .insert({
        institution_id: params.institutionId,
        entry_type: 'reward_issue',
        amount: params.amount,
        submission_id: params.submissionId,
        token_transaction_id: null,
        actor_user_id: params.actorUserId ?? null,
        notes: null,
        created_at: new Date(),
      })
      .returning('id')

    const row = inserted[0] as { id: number } | number
    const creditEntryId = typeof row === 'number' ? row : row.id

    return { creditEntryId, idempotent: false }
  }

  if (params.client) {
    return exec(params.client)
  }
  return db.transaction(exec)
}

export async function linkCreditEntryToTokenTransaction(
  creditEntryId: number,
  tokenTransactionId: number,
  trx?: DbTransaction
): Promise<void> {
  let query = fromTbl('institution_credit_entries')
    .where('id', creditEntryId)
    .update({ token_transaction_id: tokenTransactionId })

  if (trx) query = query.useTransaction(trx)
  await query
}

export async function assertInstitutionCanFundTaskReward(
  institutionId: number,
  rewardAmount: number,
  trx?: DbTransaction
): Promise<void> {
  const summary = await getInstitutionCreditPoolSummary(institutionId, trx)
  if (summary.remainingCredits < rewardAmount) {
    throw new InsufficientInstitutionCreditsError(
      institutionId,
      rewardAmount,
      summary.remainingCredits
    )
  }
}
