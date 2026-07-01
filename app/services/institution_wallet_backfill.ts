import db from '@adonisjs/lucid/services/db'
import { makeTokenService } from '#services/tokens/factory'

export async function backfillInstitutionStudentWallets(institutionId: number): Promise<number> {
  const studentRows = await db
    .from('users')
    .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
    .innerJoin('roles', 'roles.id', 'user_roles.role_id')
    .where('users.institution_id', institutionId)
    .where('roles.key', 'student')
    .select('users.id as userId')
    .distinct('users.id')

  if (studentRows.length === 0) {
    return 0
  }

  const tokenService = await makeTokenService()
  for (const row of studentRows) {
    await tokenService.createWallet(String(row.userId))
  }

  return studentRows.length
}
