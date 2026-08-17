import db from '@adonisjs/lucid/services/db'
import { ensureInstitutionCreditPool } from '#services/credits/institution_credit_pool_service'
import type {
  AllocateEqualTeacherCreditsParams,
  AllocateTeacherCreditsParams,
  DbTransaction,
  InstitutionBudgetBreakdown,
  IssueTeacherRewardCreditsParams,
  TeacherCreditPoolListItem,
  TeacherCreditPoolSummary,
} from '#services/credits/types'
import {
  InsufficientInstitutionBudgetToAssignError,
  InsufficientTeacherCreditsError,
} from '#services/credits/types'

/** Raw `teacher_credit_pools` row from Lucid query builder. */
type TeacherCreditPoolRow = {
  id: number
  institution_id: number
  teacher_id: number
  allocated_credits: number
  utilized_credits: number
  created_at: Date
  updated_at: Date | null
}

/** Raw `teacher_credit_entries` row subset used by this service. */
type TeacherCreditEntryRow = {
  id: number
  created_at: Date
}

/** Institution teacher roster row from joined users query. */
type InstitutionTeacherRow = {
  teacherId: number
  email: string
  fullName: string | null
}

type AggregateSumRow = {
  total: string | number | null
}

type AggregateCountRow = {
  total: string | number | null
}

function tbl(name: string, trx?: DbTransaction) {
  const q = db.table(name)
  return trx ? q.useTransaction(trx) : q
}

function fromTbl(name: string, trx?: DbTransaction) {
  const q = db.from(name)
  return trx ? q.useTransaction(trx) : q
}

function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0)
}

function parseInsertId(row: { id: number } | number): number {
  return typeof row === 'number' ? row : row.id
}

function toTeacherSummary(
  row: TeacherCreditPoolRow,
  lastAllocationAt: string | null
): TeacherCreditPoolSummary {
  const allocated = toNumber(row.allocated_credits)
  const utilized = toNumber(row.utilized_credits)

  return {
    teacherId: row.teacher_id,
    institutionId: row.institution_id,
    allocatedCredits: allocated,
    utilizedCredits: utilized,
    remainingCredits: allocated - utilized,
    hasPool: true,
    lastAllocationAt,
  }
}

async function fetchLastAllocationAt(
  teacherId: number,
  trx?: DbTransaction
): Promise<string | null> {
  const lastEntry = (await fromTbl('teacher_credit_entries', trx)
    .where('teacher_id', teacherId)
    .andWhere('entry_type', 'admin_allocate')
    .orderBy('created_at', 'desc')
    .first()) as TeacherCreditEntryRow | undefined

  return lastEntry?.created_at ? new Date(lastEntry.created_at).toISOString() : null
}

async function sumTeacherAllocated(institutionId: number, trx?: DbTransaction): Promise<number> {
  const row = (await fromTbl('teacher_credit_pools', trx)
    .where('institution_id', institutionId)
    .sum('allocated_credits as total')
    .first()) as AggregateSumRow | undefined

  return toNumber(row?.total)
}

export async function getInstitutionBudgetBreakdown(
  institutionId: number,
  trx?: DbTransaction
): Promise<InstitutionBudgetBreakdown> {
  await ensureInstitutionCreditPool(institutionId, trx)
  const pool = await fromTbl('institution_credit_pools', trx)
    .where('institution_id', institutionId)
    .firstOrFail()

  const allocated = toNumber(pool.allocated_credits)
  const utilized = toNumber(pool.utilized_credits)
  const delegated = await sumTeacherAllocated(institutionId, trx)

  const teacherCountRow = (await db
    .from('users as u')
    .innerJoin('user_roles as ur', 'ur.user_id', 'u.id')
    .innerJoin('roles as r', 'r.id', 'ur.role_id')
    .where('u.institution_id', institutionId)
    .andWhere('r.key', 'teacher')
    .count('* as total')
    .first()) as AggregateCountRow | undefined

  return {
    institutionId,
    allocatedCredits: allocated,
    utilizedCredits: utilized,
    delegatedCredits: delegated,
    availableToAssign: allocated - utilized - delegated,
    teacherCount: toNumber(teacherCountRow?.total),
  }
}

async function ensureTeacherCreditPool(
  institutionId: number,
  teacherId: number,
  trx?: DbTransaction
): Promise<void> {
  await tbl('teacher_credit_pools', trx)
    .insert({
      institution_id: institutionId,
      teacher_id: teacherId,
      allocated_credits: 0,
      utilized_credits: 0,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflict(['institution_id', 'teacher_id'])
    .ignore()
}

export async function teacherHasCreditPool(
  teacherId: number,
  trx?: DbTransaction
): Promise<boolean> {
  const row = await fromTbl('teacher_credit_pools', trx).where('teacher_id', teacherId).first()
  return row !== undefined
}

export async function getTeacherCreditPoolSummary(
  teacherId: number,
  trx?: DbTransaction
): Promise<TeacherCreditPoolSummary | null> {
  const row = (await fromTbl('teacher_credit_pools', trx)
    .where('teacher_id', teacherId)
    .first()) as TeacherCreditPoolRow | undefined

  if (!row) return null

  const lastAllocationAt = await fetchLastAllocationAt(teacherId, trx)
  return toTeacherSummary(row, lastAllocationAt)
}

export async function listTeacherCreditPoolsForInstitution(
  institutionId: number,
  trx?: DbTransaction
): Promise<TeacherCreditPoolListItem[]> {
  const teachers = (await db
    .from('users as u')
    .innerJoin('user_roles as ur', 'ur.user_id', 'u.id')
    .innerJoin('roles as r', 'r.id', 'ur.role_id')
    .where('u.institution_id', institutionId)
    .andWhere('r.key', 'teacher')
    .select('u.id as teacherId', 'u.email', 'u.full_name as fullName')
    .orderBy('u.full_name', 'asc')
    .orderBy('u.id', 'asc')) as InstitutionTeacherRow[]

  const poolRows = (await fromTbl('teacher_credit_pools', trx)
    .where('institution_id', institutionId)
    .select('*')) as TeacherCreditPoolRow[]

  const poolByTeacher = new Map<number, TeacherCreditPoolRow>()
  for (const row of poolRows) {
    poolByTeacher.set(row.teacher_id, row)
  }

  const items: TeacherCreditPoolListItem[] = []

  for (const teacher of teachers) {
    const pool = poolByTeacher.get(teacher.teacherId)

    if (pool) {
      const lastAllocationAt = await fetchLastAllocationAt(teacher.teacherId, trx)
      const summary = toTeacherSummary(pool, lastAllocationAt)
      items.push({
        ...summary,
        email: teacher.email,
        fullName: teacher.fullName,
      })
    } else {
      items.push({
        teacherId: teacher.teacherId,
        email: teacher.email,
        fullName: teacher.fullName,
        institutionId,
        allocatedCredits: 0,
        utilizedCredits: 0,
        remainingCredits: 0,
        hasPool: false,
        lastAllocationAt: null,
      })
    }
  }

  return items
}

async function assertTeacherInInstitution(
  institutionId: number,
  teacherId: number,
  trx?: DbTransaction
): Promise<void> {
  let query = db
    .from('users as u')
    .innerJoin('user_roles as ur', 'ur.user_id', 'u.id')
    .innerJoin('roles as r', 'r.id', 'ur.role_id')
    .where('u.id', teacherId)
    .andWhere('u.institution_id', institutionId)
    .andWhere('r.key', 'teacher')
    .select('u.id')

  if (trx) query = query.useTransaction(trx)

  const row = await query.first()
  if (!row) {
    throw new Error('Teacher not found in institution')
  }
}

async function listInstitutionTeacherIds(
  institutionId: number,
  trx?: DbTransaction
): Promise<number[]> {
  let query = db
    .from('users as u')
    .innerJoin('user_roles as ur', 'ur.user_id', 'u.id')
    .innerJoin('roles as r', 'r.id', 'ur.role_id')
    .where('u.institution_id', institutionId)
    .andWhere('r.key', 'teacher')
    .select('u.id as teacherId')
    .orderBy('u.id', 'asc')

  if (trx) query = query.useTransaction(trx)

  const rows = (await query) as Array<{ teacherId: number }>
  return rows.map((row) => row.teacherId)
}

export async function allocateToTeacher(
  params: AllocateTeacherCreditsParams
): Promise<TeacherCreditPoolSummary> {
  const exec = async (trx: DbTransaction) => {
    if (params.amount <= 0) {
      throw new Error('Allocation amount must be positive')
    }

    await assertTeacherInInstitution(params.institutionId, params.teacherId, trx)

    await ensureInstitutionCreditPool(params.institutionId, trx)
    await fromTbl('institution_credit_pools', trx)
      .where('institution_id', params.institutionId)
      .forUpdate()
      .firstOrFail()

    const breakdown = await getInstitutionBudgetBreakdown(params.institutionId, trx)
    if (params.amount > breakdown.availableToAssign) {
      throw new InsufficientInstitutionBudgetToAssignError(
        params.institutionId,
        params.amount,
        breakdown.availableToAssign
      )
    }

    await ensureTeacherCreditPool(params.institutionId, params.teacherId, trx)

    const pool = (await fromTbl('teacher_credit_pools', trx)
      .where('institution_id', params.institutionId)
      .andWhere('teacher_id', params.teacherId)
      .forUpdate()
      .firstOrFail()) as TeacherCreditPoolRow

    const nextAllocated = toNumber(pool.allocated_credits) + params.amount

    await fromTbl('teacher_credit_pools', trx)
      .where('institution_id', params.institutionId)
      .andWhere('teacher_id', params.teacherId)
      .update({
        allocated_credits: nextAllocated,
        updated_at: new Date(),
      })

    await tbl('institution_credit_entries', trx).insert({
      institution_id: params.institutionId,
      entry_type: 'teacher_delegate',
      amount: params.amount,
      submission_id: null,
      token_transaction_id: null,
      actor_user_id: params.actorUserId,
      notes: params.notes ?? `Delegated to teacher ${params.teacherId}`,
      created_at: new Date(),
    })

    await tbl('teacher_credit_entries', trx).insert({
      institution_id: params.institutionId,
      teacher_id: params.teacherId,
      entry_type: 'admin_allocate',
      amount: params.amount,
      submission_id: null,
      token_transaction_id: null,
      actor_user_id: params.actorUserId,
      notes: params.notes ?? null,
      created_at: new Date(),
    })

    const summary = await getTeacherCreditPoolSummary(params.teacherId, trx)
    if (!summary) {
      throw new Error(`Teacher credit pool missing after allocation for teacher ${params.teacherId}`)
    }

    return summary
  }

  if (params.client) {
    return exec(params.client)
  }
  return db.transaction(exec)
}

export async function allocateEqualToAllTeachers(
  params: AllocateEqualTeacherCreditsParams
): Promise<{ perTeacherAmount: number; teachersAffected: number; remainder: number }> {
  const exec = async (trx: DbTransaction) => {
    if (params.totalAmount <= 0) {
      throw new Error('Allocation amount must be positive')
    }

    const teacherIds = await listInstitutionTeacherIds(params.institutionId, trx)
    if (teacherIds.length === 0) {
      throw new Error('No teachers found in institution')
    }

    const perTeacherAmount = Math.floor(params.totalAmount / teacherIds.length)
    if (perTeacherAmount <= 0) {
      throw new Error('Total amount too small to split among teachers')
    }

    const totalToAllocate = perTeacherAmount * teacherIds.length
    const breakdown = await getInstitutionBudgetBreakdown(params.institutionId, trx)
    if (totalToAllocate > breakdown.availableToAssign) {
      throw new InsufficientInstitutionBudgetToAssignError(
        params.institutionId,
        totalToAllocate,
        breakdown.availableToAssign
      )
    }

    for (const teacherId of teacherIds) {
      await allocateToTeacher({
        institutionId: params.institutionId,
        teacherId,
        amount: perTeacherAmount,
        actorUserId: params.actorUserId,
        notes: params.notes ?? 'Equal split allocation',
        client: trx,
      })
    }

    return {
      perTeacherAmount,
      teachersAffected: teacherIds.length,
      remainder: params.totalAmount - totalToAllocate,
    }
  }

  if (params.client) {
    return exec(params.client)
  }
  return db.transaction(exec)
}

export async function debitTeacherPoolForReward(
  params: IssueTeacherRewardCreditsParams
): Promise<{ creditEntryId: number; idempotent: boolean }> {
  const exec = async (trx: DbTransaction) => {
    const existing = (await fromTbl('teacher_credit_entries', trx)
      .where({
        teacher_id: params.teacherId,
        submission_id: params.submissionId,
        entry_type: 'reward_issue',
      })
      .first()) as TeacherCreditEntryRow | undefined

    if (existing) {
      return { creditEntryId: existing.id, idempotent: true }
    }

    await ensureTeacherCreditPool(params.institutionId, params.teacherId, trx)

    const pool = (await fromTbl('teacher_credit_pools', trx)
      .where('institution_id', params.institutionId)
      .andWhere('teacher_id', params.teacherId)
      .forUpdate()
      .firstOrFail()) as TeacherCreditPoolRow

    const allocated = toNumber(pool.allocated_credits)
    const utilized = toNumber(pool.utilized_credits)
    const remaining = allocated - utilized

    if (remaining < params.amount) {
      throw new InsufficientTeacherCreditsError(params.teacherId, params.amount, remaining)
    }

    await fromTbl('teacher_credit_pools', trx)
      .where('institution_id', params.institutionId)
      .andWhere('teacher_id', params.teacherId)
      .update({
        utilized_credits: utilized + params.amount,
        updated_at: new Date(),
      })

    const inserted = await tbl('teacher_credit_entries', trx)
      .insert({
        institution_id: params.institutionId,
        teacher_id: params.teacherId,
        entry_type: 'reward_issue',
        amount: params.amount,
        submission_id: params.submissionId,
        token_transaction_id: null,
        actor_user_id: params.actorUserId ?? null,
        notes: null,
        created_at: new Date(),
      })
      .returning('id')

    const creditEntryId = parseInsertId(inserted[0] as { id: number } | number)

    return { creditEntryId, idempotent: false }
  }

  if (params.client) {
    return exec(params.client)
  }
  return db.transaction(exec)
}

export async function linkTeacherCreditEntryToTokenTransaction(
  creditEntryId: number,
  tokenTransactionId: number,
  trx?: DbTransaction
): Promise<void> {
  let query = fromTbl('teacher_credit_entries')
    .where('id', creditEntryId)
    .update({ token_transaction_id: tokenTransactionId })

  if (trx) query = query.useTransaction(trx)
  await query
}

export async function assertTeacherCanFundTaskReward(
  teacherId: number,
  rewardAmount: number,
  trx?: DbTransaction
): Promise<void> {
  const summary = await getTeacherCreditPoolSummary(teacherId, trx)
  if (!summary || summary.remainingCredits < rewardAmount) {
    throw new InsufficientTeacherCreditsError(
      teacherId,
      rewardAmount,
      summary?.remainingCredits ?? 0
    )
  }
}
