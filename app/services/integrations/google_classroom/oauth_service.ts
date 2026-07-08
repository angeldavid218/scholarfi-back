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

export type GoogleTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export type GoogleUserInfo = {
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

export async function exchangeGoogleAuthCode(code: string): Promise<GoogleTokenResponse> {
  assertGoogleClassroomConfig()

  const body = new URLSearchParams({
    code,
    client_id: googleClassroomConfig.clientId,
    client_secret: googleClassroomConfig.clientSecret,
    redirect_uri: googleClassroomConfig.redirectUri,
    grant_type: 'authorization_code',
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google token exchange failed: ${response.status} ${text}`)
  }

  return (await response.json()) as GoogleTokenResponse
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  assertGoogleClassroomConfig()

  const body = new URLSearchParams({
    client_id: googleClassroomConfig.clientId,
    client_secret: googleClassroomConfig.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google token refresh failed: ${response.status} ${text}`)
  }

  return (await response.json()) as GoogleTokenResponse
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
    await db
      .from('teacher_integrations')
      .where('id', existing.id)
      .update({
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
