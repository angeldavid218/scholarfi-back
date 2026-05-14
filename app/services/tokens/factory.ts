import tokenConfig, { assertSolanaConfig } from '#config/token'
import type { TokenService } from '#services/tokens/types'

export async function makeTokenService(): Promise<TokenService> {
  if (tokenConfig.mode === 'solana') {
    assertSolanaConfig()
    const { default: SolanaTokenService } = await import('#services/tokens/solana_token_service')
    return new SolanaTokenService()
  }
  const { default: MockTokenService } = await import('#services/tokens/mock_token_service')
  return new MockTokenService()
}

/** Sync resolver for providers that cannot use async factory at boot */
export function getTokenMode(): 'mock' | 'solana' {
  return tokenConfig.mode
}
