import crypto from 'node:crypto'
import tokenConfig from '#config/token'

const VERSION = 'v1'
const IV_LEN = 12
const AUTH_TAG_LEN = 16

function deriveKey(raw: string): Buffer {
  const buf = Buffer.from(raw, 'utf8')
  if (buf.length >= 32) {
    return buf.subarray(0, 32)
  }
  return crypto.createHash('sha256').update(buf).digest()
}

/**
 * Encrypt a custodial wallet secret for storage (AES-256-GCM).
 * Format: v1:<base64(iv+authTag+ciphertext)>
 */
export function encryptWalletSecret(plaintext: string, keyOverride?: string): string {
  const raw = keyOverride ?? tokenConfig.walletEncryptionKey
  if (!raw) {
    throw new Error('WALLET_ENCRYPTION_KEY is required for custodial wallet encryption')
  }
  const key = deriveKey(raw)
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const packed = Buffer.concat([iv, tag, enc])
  return `${VERSION}:${packed.toString('base64')}`
}

export function decryptWalletSecret(payload: string, keyOverride?: string): string {
  const raw = keyOverride ?? tokenConfig.walletEncryptionKey
  if (!raw) {
    throw new Error('WALLET_ENCRYPTION_KEY is required to decrypt custodial secrets')
  }
  const [ver, b64] = payload.split(':')
  if (ver !== VERSION || !b64) {
    throw new Error('Unsupported wallet secret payload format')
  }
  const packed = Buffer.from(b64, 'base64')
  const iv = packed.subarray(0, IV_LEN)
  const tag = packed.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN)
  const data = packed.subarray(IV_LEN + AUTH_TAG_LEN)
  const key = deriveKey(raw)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data).toString('utf8') + decipher.final('utf8')
}
