/**
 * Core Compressed NFT helpers (Metaplex Bubblegum V2 + Umi).
 * Ported from WayLearnLatam/Solana-cNFT-template with leafOwner support
 * so diplomas can be minted to a student's custodial wallet.
 */
import type { Umi, PublicKey } from '@metaplex-foundation/umi'
import { generateSigner, publicKey as toPublicKey, none } from '@metaplex-foundation/umi'
import { base58 } from '@metaplex-foundation/umi/serializers'
import {
  createTreeV2,
  mintV2,
  getAssetWithProof,
  fetchTreeConfigFromSeeds,
  parseLeafFromMintV2Transaction,
} from '@metaplex-foundation/mpl-bubblegum'
import type { AssetWithProof } from '@metaplex-foundation/mpl-bubblegum'
import type { DasApiAsset, DasApiInterface } from '@metaplex-foundation/digital-asset-standard-api'

type UmiDas = Umi & { rpc: Umi['rpc'] & DasApiInterface }

export const DEFAULT_MAX_DEPTH = 14
export const DEFAULT_MAX_BUFFER_SIZE = 64
export const DEFAULT_CANOPY_DEPTH = 11

/** Bubblegum / Token Metadata on-chain name limit (bytes, not JS characters). */
export const MAX_CNFT_NAME_BYTES = 32
export const MAX_CNFT_URI_BYTES = 200

export const DAS_INTENTOS = 9
export const DAS_ESPERA_INICIAL_MS = 2_000
export const DAS_ESPERA_MAX_MS = 30_000

export const PROOF_INTENTOS = 4
export const PROOF_ESPERA_INICIAL_MS = 3_000

export interface CnftMetadataInput {
  name: string
  uri: string
  sellerFeeBasisPoints?: number
}

export interface CreateTreeResult {
  merkleTree: PublicKey
  signature: string
}

export interface MintResult {
  assetId: PublicKey
  leafIndex: number
  signature: string
}

export interface OpcionesMutacion {
  umiRespaldo?: Umi
}

const sigToString = (signature: Uint8Array): string => base58.deserialize(signature)[0]

const asPk = (value: PublicKey | string): PublicKey =>
  typeof value === 'string' ? toPublicKey(value) : value

/** Truncate so UTF-8 byte length fits Metaplex field limits (accents count as 2+ bytes). */
export function truncateUtf8Bytes(value: string, maxBytes: number): string {
  const bytes = new TextEncoder().encode(value)
  if (bytes.length <= maxBytes) return value
  let end = maxBytes
  while (end > 0 && (bytes[end] & 0b1100_0000) === 0b1000_0000) {
    end -= 1
  }
  return new TextDecoder().decode(bytes.slice(0, end))
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function reintentarBackoff<T>(
  fn: () => Promise<T>,
  reintentarSi: (error: unknown) => boolean,
  mensajeFinal: string,
  intentos = DAS_INTENTOS,
  esperaInicialMs = DAS_ESPERA_INICIAL_MS,
  esperaMaxMs = DAS_ESPERA_MAX_MS
): Promise<T> {
  let espera = esperaInicialMs
  let ultimoError: unknown
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn()
    } catch (e) {
      ultimoError = e
      if (!reintentarSi(e)) throw e
      if (i < intentos - 1) {
        await sleep(espera)
        espera = Math.min(espera * 2, esperaMaxMs)
      }
    }
  }
  const detalle = ultimoError instanceof Error ? ` Último error: ${ultimoError.message}` : ''
  throw new Error(`${mensajeFinal}${detalle}`)
}

const esNoEncontrado = (e: unknown) =>
  /not found|no (proof|assets?) found|no encontrado/i.test(String(e))

const esTxNoLista = (e: unknown) =>
  /could not (parse leaf|get transaction)|not (found|available)/i.test(String(e))

async function esperarAssetIndexado(umi: Umi, assetId: PublicKey): Promise<DasApiAsset> {
  return reintentarBackoff(
    () => (umi as UmiDas).rpc.getAsset(assetId),
    esNoEncontrado,
    'El indexador DAS no catalogó el cNFT. Verifica el assetId, el cluster ' +
      '(devnet/mainnet) y que el RPC soporte DAS.'
  )
}

const pedirProof = (umi: Umi, assetId: PublicKey): Promise<AssetWithProof> =>
  reintentarBackoff(
    () => getAssetWithProof(umi as UmiDas, assetId, { truncateCanopy: true }),
    () => true,
    'El asset está indexado pero el proveedor no sirvió el proof.',
    PROOF_INTENTOS,
    PROOF_ESPERA_INICIAL_MS,
    DAS_ESPERA_MAX_MS
  )

async function obtenerAssetConProof(
  umi: Umi,
  assetId: PublicKey | string,
  opts?: OpcionesMutacion
): Promise<AssetWithProof> {
  const id = asPk(assetId)
  await esperarAssetIndexado(umi, id)

  try {
    return await pedirProof(umi, id)
  } catch (errorPrincipal) {
    if (!opts?.umiRespaldo) throw errorPrincipal
    try {
      return await pedirProof(opts.umiRespaldo, id)
    } catch {
      const msg = errorPrincipal instanceof Error ? errorPrincipal.message : String(errorPrincipal)
      throw new Error(`${msg} El proveedor de respaldo tampoco sirvió el proof.`)
    }
  }
}

export async function crearArbol(
  umi: Umi,
  opts?: { maxDepth?: number; maxBufferSize?: number; canopyDepth?: number }
): Promise<CreateTreeResult> {
  const merkleTree = generateSigner(umi)

  const builder = await createTreeV2(umi, {
    merkleTree,
    maxDepth: opts?.maxDepth ?? DEFAULT_MAX_DEPTH,
    maxBufferSize: opts?.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE,
    canopyDepth: opts?.canopyDepth ?? DEFAULT_CANOPY_DEPTH,
  })

  const { signature } = await builder.sendAndConfirm(umi)

  return {
    merkleTree: merkleTree.publicKey,
    signature: sigToString(signature),
  }
}

export async function usarArbolExistente(
  umi: Umi,
  merkleTree: PublicKey | string
): Promise<{ merkleTree: PublicKey; numMinted: number; capacity: number }> {
  const tree = asPk(merkleTree)
  const config = await fetchTreeConfigFromSeeds(umi, { merkleTree: tree })
  return {
    merkleTree: tree,
    numMinted: Number(config.numMinted),
    capacity: Number(config.totalMintCapacity),
  }
}

export async function mintearCnft(
  umi: Umi,
  merkleTree: PublicKey | string,
  metadata: CnftMetadataInput,
  leafOwner?: PublicKey | string
): Promise<MintResult> {
  const tree = asPk(merkleTree)
  const owner = leafOwner ? asPk(leafOwner) : umi.identity.publicKey

  const { signature } = await mintV2(umi, {
    leafOwner: owner,
    merkleTree: tree,
    metadata: {
      name: truncateUtf8Bytes(metadata.name, MAX_CNFT_NAME_BYTES),
      uri: truncateUtf8Bytes(metadata.uri, MAX_CNFT_URI_BYTES),
      sellerFeeBasisPoints: metadata.sellerFeeBasisPoints ?? 0,
      collection: none(),
      creators: [{ address: umi.identity.publicKey, verified: false, share: 100 }],
    },
  }).sendAndConfirm(umi)

  const leaf = await reintentarBackoff(
    () => parseLeafFromMintV2Transaction(umi, signature),
    esTxNoLista,
    'No se pudo leer el leaf de la tx de mint (tardó en propagarse).',
    8,
    2_000,
    15_000
  )

  return {
    assetId: leaf.id,
    leafIndex: Number(leaf.nonce),
    signature: sigToString(signature),
  }
}

export async function esperarIndexacionCnft(
  umi: Umi,
  assetId: PublicKey | string,
  opts?: OpcionesMutacion
): Promise<AssetWithProof> {
  return obtenerAssetConProof(umi, assetId, opts)
}

export async function leerCnft(umi: Umi, assetId: PublicKey | string): Promise<DasApiAsset> {
  const id = asPk(assetId)
  return reintentarBackoff(
    () => (umi as UmiDas).rpc.getAsset(id),
    esNoEncontrado,
    'El indexador DAS no encontró el cNFT (puede seguir indexándose).'
  )
}
