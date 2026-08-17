/**
 * Re-export sas-lib + @solana/signers for attestation services.
 * Prefer normal package imports so production installs (Render) resolve from node_modules.
 */
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
} from 'sas-lib'

export { createKeyPairSignerFromBytes } from '@solana/signers'

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
