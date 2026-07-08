import googleClassroomConfig from '#config/google_classroom'
import { encryptWalletSecret, decryptWalletSecret } from '#services/tokens/wallet_crypto'

export function encryptIntegrationToken(plaintext: string): string {
  const key = googleClassroomConfig.tokenEncryptionKey
  if (!key) {
    throw new Error('INTEGRATION_TOKEN_ENCRYPTION_KEY is required to store integration tokens')
  }
  return encryptWalletSecret(plaintext, key)
}

export function decryptIntegrationToken(payload: string): string {
  const key = googleClassroomConfig.tokenEncryptionKey
  if (!key) {
    throw new Error('INTEGRATION_TOKEN_ENCRYPTION_KEY is required to decrypt integration tokens')
  }
  return decryptWalletSecret(payload, key)
}
