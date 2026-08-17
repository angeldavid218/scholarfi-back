/**
 * Re-export sas-lib for attestation services.
 * Load createKeyPairSignerFromBytes from sas-lib's nested Solana Kit deps so
 * we do not require a top-level @solana/kit or @solana/signers install.
 */
import { createRequire } from 'node:module'

export {
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
  type Schema,
} from 'sas-lib'

import { deriveSchemaPda } from 'sas-lib'

const requireFromApp = createRequire(import.meta.url)
const requireFromSas = createRequire(requireFromApp.resolve('sas-lib/package.json'))

export const createKeyPairSignerFromBytes: (
  bytes: Uint8Array,
  extractable?: boolean
) => Promise<any> = requireFromSas('@solana/signers').createKeyPairSignerFromBytes

/** Solana Kit branded address (base58 string at runtime). */
export type Address = Parameters<typeof deriveSchemaPda>[0]['credential']

/** Cast a base58 string to Kit's branded Address type. */
export function asAddress(value: string): Address {
  return value as Address
}
