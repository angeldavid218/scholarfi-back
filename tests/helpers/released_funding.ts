import db from '@adonisjs/lucid/services/db'

export async function seedReleasedFunding(
  institutionId: number,
  allocatedBudget: number,
  options?: { releasedAt?: Date; programStatus?: string }
) {
  const releasedAt = options?.releasedAt ?? new Date()
  const programStatus = options?.programStatus ?? 'active'

  const ngoInsert = await db
    .table('ngo_institutions')
    .insert({
      name: `NGO Seed ${Date.now()}`,
      code: `NGO-SEED-${Date.now()}`,
      status: true,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const ngoId = typeof ngoInsert[0] === 'number' ? ngoInsert[0] : (ngoInsert[0] as { id: number }).id

  const programInsert = await db
    .table('funding_programs')
    .insert({
      ngo_institution_id: ngoId,
      name: 'Seed Funding Program',
      description: 'Test funding',
      total_budget: allocatedBudget,
      allocation_type: 'manual',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: programStatus,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const programId =
    typeof programInsert[0] === 'number' ? programInsert[0] : (programInsert[0] as { id: number }).id

  const allocationInsert = await db
    .table('budget_allocations')
    .insert({
      funding_program_id: programId,
      institution_id: institutionId,
      allocated_budget: allocatedBudget,
      utilized_budget: 0,
      status: 'active',
      released_at: releasedAt,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  const allocationId =
    typeof allocationInsert[0] === 'number'
      ? allocationInsert[0]
      : (allocationInsert[0] as { id: number }).id

  return { ngoId, programId, allocationId }
}
