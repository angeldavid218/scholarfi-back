/**
 * Load sas-lib + @solana/signers from vendor-sas (main node_modules is root-owned).
 * When `npm install sas-lib` works in the app root, prefer that path instead.
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const vendorRequire = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), '../../../vendor-sas/package.json')
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sasLib: any = vendorRequire('sas-lib')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const solanaSigners: any = vendorRequire('@solana/signers')

export const {
  deserializeAttestationData,
  deriveAttestationPda,
  deriveCredentialPda,
  deriveSchemaPda,
  getAttestationDecoder,
  getCreateAttestationInstruction,
  getCreateCredentialInstruction,
  getCreateSchemaInstruction,
  getSchemaDecoder,
  serializeAttestationData,
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS,
} = sasLib

export type Schema = {
  discriminator: number
  credential: string
  name: Uint8Array
  description: Uint8Array
  layout: Uint8Array
  fieldNames: Uint8Array
  isPaused: boolean
  version: number
}

export const createKeyPairSignerFromBytes: (
  bytes: Uint8Array
) => Promise<{ address: string }> = solanaSigners.createKeyPairSignerFromBytes
