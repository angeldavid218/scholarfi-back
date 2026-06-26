import env from '#start/env'

export type TokenMode = 'mock' | 'solana'

function readMode(): TokenMode {
  const raw = env.get('TOKEN_MODE') as string | undefined
  return raw === 'solana' ? 'solana' : 'mock'
}

const tokenConfig = {
  get mode(): TokenMode {
    return readMode()
  },
  get solanaRpcUrl(): string {
    return (env.get('SOLANA_RPC_URL') as string | undefined) ?? ''
  },
  get tokenMint(): string {
    return (env.get('SCHOLARFI_TOKEN_MINT') as string | undefined) ?? ''
  },
  get mintAuthoritySecret(): string {
    return (env.get('MINT_AUTHORITY_SECRET') as string | undefined) ?? ''
  },
  get treasuryPublicKey(): string {
    return (env.get('TREASURY_WALLET_PUBLIC_KEY') as string | undefined) ?? ''
  },
  get walletEncryptionKey(): string {
    return (env.get('WALLET_ENCRYPTION_KEY') as string | undefined) ?? ''
  },
}

export default tokenConfig

export function assertSolanaConfig(): void {
  const missing: string[] = []
  if (!tokenConfig.solanaRpcUrl) missing.push('SOLANA_RPC_URL')
  if (!tokenConfig.tokenMint) missing.push('SCHOLARFI_TOKEN_MINT')
  if (!tokenConfig.mintAuthoritySecret) missing.push('MINT_AUTHORITY_SECRET')
  if (!tokenConfig.treasuryPublicKey) missing.push('TREASURY_WALLET_PUBLIC_KEY')
  if (!tokenConfig.walletEncryptionKey) missing.push('WALLET_ENCRYPTION_KEY')
  if (missing.length > 0) {
    throw new Error(`TOKEN_MODE=solana requires: ${missing.join(', ')}`)
  }
}
