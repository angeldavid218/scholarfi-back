import Institution from '#models/institution'
import tokenConfig, { assertSolanaConfig } from '#config/token'
import type { TokenService } from '#services/tokens/types'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type ExecutionProvider = 'mock' | 'solana'

export async function isInstitutionOnChainExecution(
  institutionId: number,
  trx?: TransactionClientContract
): Promise<boolean> {
  let query = Institution.query().where('id', institutionId).select('crypto_wallets_enabled')
  if (trx) query = query.useTransaction(trx)
  const row = await query.first()
  return Boolean(row?.cryptoWalletsEnabled) && tokenConfig.mode === 'solana'
}

export async function makeTokenServiceForInstitution(
  institutionId: number,
  trx?: TransactionClientContract
): Promise<TokenService> {
  const onChain = await isInstitutionOnChainExecution(institutionId, trx)
  if (onChain) {
    assertSolanaConfig()
    const { default: SolanaTokenService } = await import('#services/tokens/solana_token_service')
    return new SolanaTokenService()
  }
  const { default: MockTokenService } = await import('#services/tokens/mock_token_service')
  return new MockTokenService()
}

/** @deprecated Use makeTokenServiceForInstitution when institution context is known */
export async function makeTokenService(): Promise<TokenService> {
  if (tokenConfig.mode === 'solana') {
    assertSolanaConfig()
    const { default: SolanaTokenService } = await import('#services/tokens/solana_token_service')
    return new SolanaTokenService()
  }
  const { default: MockTokenService } = await import('#services/tokens/mock_token_service')
  return new MockTokenService()
}

export function getTokenMode(): 'mock' | 'solana' {
  return tokenConfig.mode
}
