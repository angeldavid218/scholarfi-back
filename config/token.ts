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
  get cnftMerkleTree(): string {
    return (env.get('CNFT_MERKLE_TREE') as string | undefined)?.trim() ?? ''
  },
  get cnftMetadataBaseUrl(): string {
    const explicit = (env.get('CNFT_METADATA_BASE_URL') as string | undefined)?.trim()
    if (explicit) return explicit.replace(/\/$/, '')
    return (env.get('APP_URL') as string | undefined)?.replace(/\/$/, '') ?? ''
  },
  get cnftMetadataImageUrl(): string {
    const explicit = (env.get('CNFT_METADATA_IMAGE_URL') as string | undefined)?.trim()
    if (explicit) return explicit
    return ''
  },
  get cnftAcademicPeriod(): string {
    const explicit = (env.get('CNFT_ACADEMIC_PERIOD') as string | undefined)?.trim()
    if (explicit) return explicit
    const now = new Date()
    const year = now.getFullYear()
    // Northern-hemisphere school year: Aug–Jul
    if (now.getMonth() >= 7) return `${year}-${year + 1}`
    return `${year - 1}-${year}`
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

/** RPC + payer for creating the Bubblegum tree (`node ace cnft:setup-tree`). */
export function assertCnftTreeSetupConfig(): void {
  const missing: string[] = []
  if (!tokenConfig.solanaRpcUrl) missing.push('SOLANA_RPC_URL')
  if (!tokenConfig.mintAuthoritySecret) missing.push('MINT_AUTHORITY_SECRET')
  if (missing.length > 0) {
    throw new Error(`cNFT tree setup requires: ${missing.join(', ')}`)
  }
}

/** Config needed to mint diplomas against an existing tree. */
export function assertCnftMintConfig(): void {
  assertCnftTreeSetupConfig()
  if (!tokenConfig.cnftMerkleTree) {
    throw new Error(
      'cNFT minting requires CNFT_MERKLE_TREE. Run `node ace cnft:setup-tree` and pin the address in .env. SOLANA_RPC_URL must be DAS-capable (e.g. Helius); api.devnet.solana.com is not.'
    )
  }
}
