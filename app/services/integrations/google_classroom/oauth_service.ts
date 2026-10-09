import db from '@adonisjs/lucid/services/db'
import googleClassroomConfig, { assertGoogleClassroomConfig } from '#config/google_classroom'
import {
  decryptIntegrationToken,
  encryptIntegrationToken,
} from '#services/integrations/integration_token_crypto'
import { signOAuthState } from '#services/integrations/google_classroom/oauth_state'
import type { TeacherIntegrationRow } from '#services/integrations/google_classroom/types'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export interface GoogleUserInfo {
  id: string
  email: string
}

export function buildGoogleAuthUrl(input: { teacherId: number; institutionId: number }): string {
  assertGoogleClassroomConfig()

  const state = signOAuthState({
    teacherId: input.teacherId,
    institutionId: input.institutionId,
    ts: Date.now(),
  })

  const params = new URLSearchParams({
    client_id: googleClassroomConfig.clientId,
    redirect_uri: googleClassroomConfig.redirectUri,
    response_type: 'code',
    scope: googleClassroomConfig.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

async function postGoogleToken(
  params: Record<string, string>,
  failureLabel: string
): Promise<GoogleTokenResponse> {
  assertGoogleClassroomConfig()

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${failureLabel}: ${response.status} ${text}`)
  }

  return (await response.json()) as GoogleTokenResponse
}

export async function exchangeGoogleAuthCode(code: string): Promise<GoogleTokenResponse> {
  return postGoogleToken(
    {
      code,
      client_id: googleClassroomConfig.clientId,
      client_secret: googleClassroomConfig.clientSecret,
      redirect_uri: googleClassroomConfig.redirectUri,
      grant_type: 'authorization_code',
    },
    'Google token exchange failed'
  )
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  return postGoogleToken(
    {
      client_id: googleClassroomConfig.clientId,
      client_secret: googleClassroomConfig.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    },
    'Google token refresh failed'
  )
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google userinfo failed: ${response.status} ${text}`)
  }

  const data = (await response.json()) as { id?: string; email?: string }
  if (!data.id || !data.email) {
    throw new Error('Google userinfo missing id or email')
  }

  return { id: data.id, email: data.email }
}

export async function getTeacherIntegration(
  teacherId: number
): Promise<TeacherIntegrationRow | null> {
  const row = await db
    .from('teacher_integrations')
    .where('teacher_id', teacherId)
    .andWhere('provider', 'google_classroom')
    .first()

  return row ? (row as TeacherIntegrationRow) : null
}

export interface ConnectedClassroomTeacher {
  teacherId: number
  institutionId: number
}

export async function listConnectedClassroomTeachers(): Promise<ConnectedClassroomTeacher[]> {
  const rows = await db
    .from('teacher_integrations')
    .where('provider', 'google_classroom')
    .select('teacher_id', 'institution_id')

  return (rows as Array<{ teacher_id: number; institution_id: number }>).map((row) => ({
    teacherId: row.teacher_id,
    institutionId: row.institution_id,
  }))
}

export const MOCK_CLASSROOM_EXTERNAL_USER_ID = 'gc-teacher-1'
export const MOCK_CLASSROOM_EXTERNAL_EMAIL = 'demo.teacher@scholarfi.test'
export const MOCK_CLASSROOM_REFRESH_TOKEN = 'mock-refresh-token'

const MOCK_CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/userinfo.email',
]

/**
 * Local fixture connection used when GOOGLE_CLASSROOM_MOCK=true (no Google OAuth).
 */
export async function ensureMockTeacherIntegration(
  teacherId: number,
  institutionId: number
): Promise<TeacherIntegrationRow> {
  const scopes =
    googleClassroomConfig.scopes.length > 0 ? googleClassroomConfig.scopes : MOCK_CLASSROOM_SCOPES

  return upsertTeacherIntegration({
    teacherId,
    institutionId,
    externalUserId: MOCK_CLASSROOM_EXTERNAL_USER_ID,
    externalEmail: MOCK_CLASSROOM_EXTERNAL_EMAIL,
    refreshToken: MOCK_CLASSROOM_REFRESH_TOKEN,
    scopes,
  })
}

export async function upsertTeacherIntegration(input: {
  teacherId: number
  institutionId: number
  externalUserId: string
  externalEmail: string
  refreshToken: string
  scopes: string[]
}): Promise<TeacherIntegrationRow> {
  const encrypted = encryptIntegrationToken(input.refreshToken)
  const scopes = input.scopes.join(',')

  const existing = await getTeacherIntegration(input.teacherId)
  if (existing) {
    await db.from('teacher_integrations').where('id', existing.id).update({
      external_user_id: input.externalUserId,
      external_email: input.externalEmail,
      encrypted_refresh_token: encrypted,
      scopes,
      connected_at: new Date(),
      updated_at: new Date(),
    })

    const updated = await getTeacherIntegration(input.teacherId)
    if (!updated) throw new Error('Failed to reload teacher integration')
    return updated
  }

  const inserted = await db
    .table('teacher_integrations')
    .insert({
      teacher_id: input.teacherId,
      institution_id: input.institutionId,
      provider: 'google_classroom',
      external_user_id: input.externalUserId,
      external_email: input.externalEmail,
      encrypted_refresh_token: encrypted,
      scopes,
      connected_at: new Date(),
      last_sync_at: null,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('*')

  return inserted[0] as TeacherIntegrationRow
}

export async function deleteTeacherIntegration(teacherId: number): Promise<void> {
  await db
    .from('teacher_integrations')
    .where('teacher_id', teacherId)
    .andWhere('provider', 'google_classroom')
    .delete()
}

export async function getTeacherRefreshToken(teacherId: number): Promise<string | null> {
  const row = await getTeacherIntegration(teacherId)
  if (!row) return null
  return decryptIntegrationToken(row.encrypted_refresh_token)
}

export async function markTeacherIntegrationSynced(teacherId: number): Promise<void> {
  await db
    .from('teacher_integrations')
    .where('teacher_id', teacherId)
    .andWhere('provider', 'google_classroom')
    .update({
      last_sync_at: new Date(),
      updated_at: new Date(),
    })
}
