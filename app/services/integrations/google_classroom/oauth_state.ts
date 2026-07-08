import crypto from 'node:crypto'
import env from '#start/env'

export type OAuthStatePayload = {
  teacherId: number
  institutionId: number
  ts: number
}

function appKey(): string {
  return env.get('APP_KEY').release() as string
}

export function signOAuthState(payload: OAuthStatePayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', appKey()).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyOAuthState(state: string): OAuthStatePayload {
  const [data, sig] = state.split('.')
  if (!data || !sig) {
    throw new Error('Invalid OAuth state format')
  }

  const expected = crypto.createHmac('sha256', appKey()).update(data).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid OAuth state signature')
  }

  const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as OAuthStatePayload
  const maxAgeMs = 15 * 60 * 1000
  if (Date.now() - payload.ts > maxAgeMs) {
    throw new Error('OAuth state expired')
  }

  return payload
}
