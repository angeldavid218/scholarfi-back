import TokenTransaction from '#models/token_transaction'
import db from '@adonisjs/lucid/services/db'
import type { DbTransaction } from '#services/tokens/types'
import type {
  MintTokensParams,
  RedeemTokensParams,
  TokenLedgerRow,
  TokenService,
  TokenTransactionResult,
  WalletResult,
} from '#services/tokens/types'

function mapRow(row: TokenTransaction): TokenLedgerRow {
  return {
    id: row.id,
    institutionId: row.institutionId,
    userId: row.userId,
    achievementId: row.achievementId,
    redemptionId: row.redemptionId,
    amount: row.amount,
    type: row.type as TokenLedgerRow['type'],
    status: row.status as TokenLedgerRow['status'],
    provider: row.provider as TokenLedgerRow['provider'],
    transactionSignature: row.transactionSignature,
    tokenMint: row.tokenMint,
    walletPublicKey: row.walletPublicKey,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  }
}

function tbl(name: string, trx?: DbTransaction) {
  const q = db.table(name)
  return trx ? q.useTransaction(trx) : q
}

function fromTbl(name: string, trx?: DbTransaction) {
  const q = db.from(name)
  return trx ? q.useTransaction(trx) : q
}

async function ensureBalanceRow(userId: number, trx?: DbTransaction) {
  await tbl('token_balances', trx)
    .insert({
      user_id: userId,
      balance: 0,
      updated_at: new Date(),
    })
    .onConflict('user_id')
    .ignore()
}

export default class MockTokenService implements TokenService {
  async createWallet(userId: string): Promise<WalletResult> {
    const id = Number(userId)
    await ensureBalanceRow(id)
    return {
      userId,
      walletPublicKey: null,
      encryptedSecretStored: false,
    }
  }

  async mintTokens(params: MintTokensParams): Promise<TokenTransactionResult> {
    const exec = async (trx?: DbTransaction) => {
      await ensureBalanceRow(params.userId, trx)

      if (params.achievementId) {
        const existing = await fromTbl('token_transactions', trx)
          .where({
            achievement_id: params.achievementId,
            type: 'mint',
          })
          .first()
        if (existing) {
          return {
            transactionId: existing.id as number,
            amount: Number(existing.amount),
            status: 'confirmed' as const,
            transactionSignature: null,
            idempotent: true,
          }
        }
      }

      const inserted = await tbl('token_transactions', trx)
        .insert({
          institution_id: params.institutionId,
          user_id: params.userId,
          achievement_id: params.achievementId ?? null,
          redemption_id: null,
          amount: params.amount,
          type: 'mint',
          status: 'confirmed',
          provider: 'mock',
          transaction_signature: null,
          token_mint: null,
          wallet_public_key: null,
          error_message: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')

      const row = inserted[0] as { id: number } | number
      const txId = typeof row === 'number' ? row : row.id

      await fromTbl('token_balances', trx)
        .where('user_id', params.userId)
        .update({
          balance: db.raw('token_balances.balance + ?', [params.amount]),
          updated_at: new Date(),
        })

      return {
        transactionId: txId,
        amount: params.amount,
        status: 'confirmed' as const,
        transactionSignature: null,
        idempotent: false,
      }
    }

    if (params.client) {
      return exec(params.client)
    }
    return db.transaction(async (trx) => exec(trx))
  }

  async getBalance(userId: string): Promise<number> {
    const row = await db.from('token_balances').where('user_id', Number(userId)).first()
    return row ? Number(row.balance) : 0
  }

  async redeemTokens(params: RedeemTokensParams): Promise<TokenTransactionResult> {
    const exec = async (trx?: DbTransaction) => {
      await ensureBalanceRow(params.userId, trx)

      const balanceRow = await fromTbl('token_balances', trx)
        .where('user_id', params.userId)
        .forUpdate()
        .first()

      const bal = balanceRow ? Number(balanceRow.balance) : 0
      if (bal < params.amount) {
        const inserted = await tbl('token_transactions', trx)
          .insert({
            institution_id: params.institutionId,
            user_id: params.userId,
            achievement_id: null,
            redemption_id: params.redemptionId,
            amount: params.amount,
            type: 'redeem',
            status: 'failed',
            provider: 'mock',
            transaction_signature: null,
            token_mint: null,
            wallet_public_key: null,
            error_message: 'INSUFFICIENT_BALANCE',
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('id')
        const ins = inserted[0] as { id: number } | number
        const txId = typeof ins === 'number' ? ins : ins.id
        return {
          transactionId: txId,
          amount: params.amount,
          status: 'failed' as const,
          transactionSignature: null,
        }
      }

      const inserted = await tbl('token_transactions', trx)
        .insert({
          institution_id: params.institutionId,
          user_id: params.userId,
          achievement_id: null,
          redemption_id: params.redemptionId,
          amount: params.amount,
          type: 'redeem',
          status: 'confirmed',
          provider: 'mock',
          transaction_signature: null,
          token_mint: null,
          wallet_public_key: null,
          error_message: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')

      const ins = inserted[0] as { id: number } | number
      const txId = typeof ins === 'number' ? ins : ins.id

      await fromTbl('token_balances', trx)
        .where('user_id', params.userId)
        .update({
          balance: db.raw('token_balances.balance - ?', [params.amount]),
          updated_at: new Date(),
        })

      return {
        transactionId: txId,
        amount: params.amount,
        status: 'confirmed' as const,
        transactionSignature: null,
      }
    }

    if (params.client) {
      return exec(params.client)
    }
    return db.transaction(async (trx) => exec(trx))
  }

  async getTransactionHistory(userId: string, institutionId: number): Promise<TokenLedgerRow[]> {
    const rows = await TokenTransaction.query()
      .where('user_id', Number(userId))
      .andWhere('institution_id', institutionId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
    return rows.map(mapRow)
  }

  async getInstitutionTransactionHistory(
    institutionId: number,
    options?: { page?: number; perPage?: number }
  ) {
    const page = options?.page ?? 1
    const perPage = Math.min(options?.perPage ?? 10, 100)
    const rewards = await TokenTransaction.query()
      .where('institution_id', institutionId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)

    return {
      items: rewards.all().map(mapRow),
      meta: rewards.getMeta() as unknown as Record<string, unknown>,
    }
  }
}
