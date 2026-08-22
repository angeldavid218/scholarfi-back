import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { keypairIdentity } from '@metaplex-foundation/umi'
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum'
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api'
import type { Umi } from '@metaplex-foundation/umi'
import bs58 from 'bs58'
import tokenConfig from '#config/token'

function loadMintAuthoritySecretBytes(): Uint8Array {
  const secret = tokenConfig.mintAuthoritySecret.trim()
  if (!secret) {
    throw new Error('MINT_AUTHORITY_SECRET is required for cNFT operations')
  }
  if (secret.startsWith('[')) {
    return Uint8Array.from(JSON.parse(secret))
  }
  return bs58.decode(secret)
}

/**
 * Umi client signed by the custodial mint-authority keypair (template scenario C).
 * No wallet adapter — identity is the backend key that also pays tree rent and mint fees.
 */
export function createCnftUmi(): Umi {
  if (!tokenConfig.solanaRpcUrl) {
    throw new Error(
      'SOLANA_RPC_URL is required for cNFT operations and must support DAS (e.g. Helius)'
    )
  }

  const umi = createUmi(tokenConfig.solanaRpcUrl).use(mplBubblegum()).use(dasApi())
  const keypair = umi.eddsa.createKeypairFromSecretKey(loadMintAuthoritySecretBytes())
  umi.use(keypairIdentity(keypair))
  return umi
}

export function cnftIdentityPublicKey(umi: Umi): string {
  return umi.identity.publicKey.toString()
}
