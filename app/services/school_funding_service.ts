import BudgetAllocation from '#models/budget_allocation'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { toIsoDateTime } from '../utils/parse_datetime.ts'

export type SchoolFundingProgramRow = {
  fundingProgramId: number
  programName: string
  ngoName: string
  allocatedBudget: number
  utilizedBudget: number
  availableBudget: number
  releasedAt: string | null
}

export type SchoolFundingSummary = {
  availableBudget: number
  allocatedBudget: number
  utilizedBudget: number
  programs: SchoolFundingProgramRow[]
}

export class InsufficientFundingBalanceError extends Error {
  code = 'INSUFFICIENT_FUNDING_BALANCE' as const

  constructor() {
    super('Insufficient NGO funding balance to post this reward')
  }
}

type SpendableRow = {
  id: number
  allocatedBudget: number
  utilizedBudget: number
  releasedAt: Date
}

async function loadSpendableRows(
  institutionId: number,
  trx?: TransactionClientContract
): Promise<SpendableRow[]> {
  const query = db
    .from('budget_allocations')
    .innerJoin('funding_programs', 'funding_programs.id', 'budget_allocations.funding_program_id')
    .where('budget_allocations.institution_id', institutionId)
    .where('budget_allocations.status', 'active')
    .whereNotNull('budget_allocations.released_at')
    .where('funding_programs.status', 'active')
    .select(
      'budget_allocations.id as id',
      'budget_allocations.allocated_budget as allocatedBudget',
      'budget_allocations.utilized_budget as utilizedBudget',
      'budget_allocations.released_at as releasedAt'
    )
    .orderBy('budget_allocations.released_at', 'asc')
    .orderBy('budget_allocations.id', 'asc')

  if (trx) {
    query.useTransaction(trx).forUpdate()
  }

  return (await query) as SpendableRow[]
}

function sumAvailable(rows: SpendableRow[]): number {
  return rows.reduce((sum, row) => sum + (row.allocatedBudget - row.utilizedBudget), 0)
}

export async function getSchoolFundingSummary(
  institutionId: number
): Promise<SchoolFundingSummary> {
  const rows = await db
    .from('budget_allocations')
    .innerJoin('funding_programs', 'funding_programs.id', 'budget_allocations.funding_program_id')
    .innerJoin('ngo_institutions', 'ngo_institutions.id', 'funding_programs.ngo_institution_id')
    .where('budget_allocations.institution_id', institutionId)
    .where('budget_allocations.status', 'active')
    .whereNotNull('budget_allocations.released_at')
    .where('funding_programs.status', 'active')
    .select(
      'funding_programs.id as fundingProgramId',
      'funding_programs.name as programName',
      'ngo_institutions.name as ngoName',
      'budget_allocations.allocated_budget as allocatedBudget',
      'budget_allocations.utilized_budget as utilizedBudget',
      'budget_allocations.released_at as releasedAt'
    )
    .orderBy('budget_allocations.released_at', 'asc')
    .orderBy('budget_allocations.id', 'asc')

  const programs: SchoolFundingProgramRow[] = rows.map((row) => {
    const allocatedBudget = Number(row.allocatedBudget)
    const utilizedBudget = Number(row.utilizedBudget)

    return {
      fundingProgramId: Number(row.fundingProgramId),
      programName: String(row.programName),
      ngoName: String(row.ngoName),
      allocatedBudget,
      utilizedBudget,
      availableBudget: allocatedBudget - utilizedBudget,
      releasedAt: toIsoDateTime(row.releasedAt as Date | string | null),
    }
  })

  const allocatedBudget = programs.reduce((sum, row) => sum + row.allocatedBudget, 0)
  const utilizedBudget = programs.reduce((sum, row) => sum + row.utilizedBudget, 0)

  return {
    availableBudget: allocatedBudget - utilizedBudget,
    allocatedBudget,
    utilizedBudget,
    programs,
  }
}

export async function assertCanSpend(
  institutionId: number,
  amount: number,
  trx: TransactionClientContract
): Promise<void> {
  const rows = await loadSpendableRows(institutionId, trx)
  if (sumAvailable(rows) < amount) {
    throw new InsufficientFundingBalanceError()
  }
}

export async function consumeFifo(
  institutionId: number,
  amount: number,
  trx: TransactionClientContract
): Promise<{ budgetAllocationId: number }> {
  const rows = await loadSpendableRows(institutionId, trx)
  let remaining = amount
  let primaryAllocationId: number | null = null

  for (const row of rows) {
    if (remaining <= 0) break

    const available = row.allocatedBudget - row.utilizedBudget
    if (available <= 0) continue

    const debit = Math.min(remaining, available)
    if (primaryAllocationId === null) {
      primaryAllocationId = row.id
    }

    const allocation = await BudgetAllocation.query({ client: trx })
      .where('id', row.id)
      .forUpdate()
      .firstOrFail()

    allocation.utilizedBudget += debit
    await allocation.save()

    remaining -= debit
  }

  if (remaining > 0 || primaryAllocationId === null) {
    throw new InsufficientFundingBalanceError()
  }

  return { budgetAllocationId: primaryAllocationId }
}

export async function releaseProgramAllocations(
  programId: number,
  trx: TransactionClientContract
): Promise<void> {
  const now = new Date()
  await db
    .from('budget_allocations')
    .useTransaction(trx)
    .where('funding_program_id', programId)
    .whereNull('released_at')
    .update({
      released_at: now,
      updated_at: now,
    })
}

export async function sumProgramAllocatedBudget(programId: number): Promise<number> {
  const row = await db
    .from('budget_allocations')
    .where('funding_program_id', programId)
    .sum('allocated_budget as total')
    .first()
  return Number(row?.total ?? 0)
}

export async function countProgramAllocations(programId: number): Promise<number> {
  const row = await db
    .from('budget_allocations')
    .where('funding_program_id', programId)
    .count('* as total')
    .first()
  return Number(row?.total ?? 0)
}
