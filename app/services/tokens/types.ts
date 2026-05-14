import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { DateTime } from 'luxon'

/** Adonis Lucid transaction client passed from `db.transaction` */
export type DbTransaction = TransactionClientContract

export type TokenTransactionType = 'mint' | 'redeem' | 'burn' | 'transfer'
export type TokenTransactionStatus = 'pending' | 'confirmed' | 'failed'
export type TokenProvider = 'mock' | 'solana'

export interface WalletResult {
  userId: string
  walletPublicKey: string | null
  encryptedSecretStored: boolean
}

export interface MintTokensParams {
  userId: number
  institutionId: number
  amount: number
  /** Submission id (achievement) for idempotent mint */
  achievementId?: number
  client?: DbTransaction
}

export interface RedeemTokensParams {
  userId: number
  institutionId: number
  amount: number
  redemptionId: number
  client?: DbTransaction
}

export interface TokenTransactionResult {
  transactionId: number
  amount: number
  status: TokenTransactionStatus
  transactionSignature: string | null
  idempotent?: boolean
}

export interface TokenLedgerRow {
  id: number
  institutionId: number
  userId: number
  achievementId: number | null
  redemptionId: number | null
  amount: number
  type: TokenTransactionType
  status: TokenTransactionStatus
  provider: TokenProvider
  transactionSignature: string | null
  tokenMint: string | null
  walletPublicKey: string | null
  errorMessage: string | null
  createdAt: DateTime
}

export interface TokenService {
  createWallet(userId: string): Promise<WalletResult>
  mintTokens(params: MintTokensParams): Promise<TokenTransactionResult>
  getBalance(userId: string): Promise<number>
  redeemTokens(params: RedeemTokensParams): Promise<TokenTransactionResult>
  getTransactionHistory(userId: string, institutionId: number): Promise<TokenLedgerRow[]>
  getInstitutionTransactionHistory(
    institutionId: number,
    options?: { page?: number; perPage?: number }
  ): Promise<{ items: TokenLedgerRow[]; meta: Record<string, unknown> }>
}
