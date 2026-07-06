import db from '@adonisjs/lucid/services/db'

export async function seedInstitutionCredits(institutionId: number, amount: number) {
  await db
    .table('institution_credit_pools')
    .insert({
      institution_id: institutionId,
      allocated_credits: amount,
      utilized_credits: 0,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflict('institution_id')
    .merge({
      allocated_credits: db.raw('institution_credit_pools.allocated_credits + ?', [amount]),
      updated_at: new Date(),
    })
}
