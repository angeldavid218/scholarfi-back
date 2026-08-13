import env from '#start/env'

function readScopes(): string[] {
  const raw = (env.get('GOOGLE_OAUTH_SCOPES') as string | undefined) ?? ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

const googleClassroomConfig = {
  get clientId(): string {
    return (env.get('GOOGLE_CLIENT_ID') as string | undefined) ?? ''
  },
  get clientSecret(): string {
    return (env.get('GOOGLE_CLIENT_SECRET') as string | undefined) ?? ''
  },
  get redirectUri(): string {
    return (env.get('GOOGLE_REDIRECT_URI') as string | undefined) ?? ''
  },
  get scopes(): string[] {
    return readScopes()
  },
  get tokenEncryptionKey(): string {
    return (env.get('INTEGRATION_TOKEN_ENCRYPTION_KEY') as string | undefined) ?? ''
  },
  get frontendUrl(): string {
    return (env.get('FRONTEND_URL') as string | undefined) ?? 'http://localhost:5173'
  },
  get mockMode(): boolean {
    return (env.get('GOOGLE_CLASSROOM_MOCK') as string | undefined) === 'true'
  },
  get studentDefaultPassword(): string {
    const configured = (env.get('CLASSROOM_STUDENT_DEFAULT_PASSWORD') as string | undefined)?.trim()
    return configured && configured.length > 0 ? configured : 'scholarfi-pass'
  },
}

export default googleClassroomConfig

export function assertGoogleClassroomConfig(): void {
  const missing: string[] = []
  if (!googleClassroomConfig.clientId) missing.push('GOOGLE_CLIENT_ID')
  if (!googleClassroomConfig.clientSecret) missing.push('GOOGLE_CLIENT_SECRET')
  if (!googleClassroomConfig.redirectUri) missing.push('GOOGLE_REDIRECT_URI')
  if (googleClassroomConfig.scopes.length === 0) missing.push('GOOGLE_OAUTH_SCOPES')
  if (!googleClassroomConfig.tokenEncryptionKey) missing.push('INTEGRATION_TOKEN_ENCRYPTION_KEY')
  if (missing.length > 0) {
    throw new Error(`Google Classroom integration requires: ${missing.join(', ')}`)
  }
}
