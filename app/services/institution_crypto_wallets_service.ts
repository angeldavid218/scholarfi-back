import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { makeTokenService } from '#services/tokens/factory'

async function ensureStudentBalanceRow(userId: number, trx?: TransactionClientContract) {
  let query = db
    .table('token_balances')
    .insert({
      user_id: userId,
      balance: 0,
      updated_at: new Date(),
    })
    .onConflict('user_id')
    .ignore()

  if (trx) query = query.useTransaction(trx)

  await query
}

export async function isInstitutionCryptoWalletsEnabled(
  institutionId: number,
  trx?: TransactionClientContract
): Promise<boolean> {
  let query = db
    .from('institutions')
    .where('id', institutionId)
    .select('crypto_wallets_enabled')

  if (trx) query = query.useTransaction(trx)

  const row = await query.first()
  return Boolean(row?.crypto_wallets_enabled)
}

/** Creates a student wallet only when the institution has crypto wallets enabled. */
export async function maybeCreateStudentWallet(
  institutionId: number,
  userId: number,
  trx?: TransactionClientContract
): Promise<boolean> {
  if (!(await isInstitutionCryptoWalletsEnabled(institutionId, trx))) {
    return false
  }

  if (trx) {
    await ensureStudentBalanceRow(userId, trx)
    return true
  }

  const tokenService = await makeTokenService()
  await tokenService.createWallet(String(userId))
  return true
}
