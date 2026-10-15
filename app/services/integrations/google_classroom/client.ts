import googleClassroomConfig from '#config/google_classroom'
import { buildGradeMapsFromSubmissions } from '#services/integrations/google_classroom/grade_maps'
import {
  gcLogDebug,
  gcLogError,
  gcLogInfo,
  gcLogWarn,
  type GoogleClassroomLogContext,
} from '#services/integrations/google_classroom/logger'
import {
  MOCK_COURSES,
  listClassroomMockRosterForCourse,
  mockCourseWorkForCourse,
  mockSubmissionsForCourseWork,
  mockSubmissionsUsedFallback,
} from '#services/integrations/google_classroom/mock_data'
import { refreshGoogleAccessToken } from '#services/integrations/google_classroom/oauth_service'
import type {
  ClassroomGradeMaps,
  ClassroomRosterMember,
  GoogleClassroomCourse,
  GoogleClassroomCourseWork,
  GoogleClassroomStudentSubmission,
} from '#services/integrations/google_classroom/types'

export type { ClassroomGradeMaps, ClassroomRosterMember }

const CLASSROOM_BASE = 'https://classroom.googleapis.com/v1'
const ACCESS_TOKEN_EXPIRY_SKEW_MS = 60_000

export class ClassroomApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: Array<{ reason?: string }>
  ) {
    super(message)
    this.name = 'ClassroomApiError'
  }
}

interface CachedAccessToken {
  accessToken: string
  expiresAtMs: number
}

interface ClassroomListResponse {
  courseWork?: unknown[]
  studentSubmissions?: unknown[]
  courses?: unknown[]
  students?: unknown[]
  nextPageToken?: string
}

type ClassroomCollectionKey = 'courses' | 'courseWork' | 'studentSubmissions' | 'students'

const accessTokenCache = new Map<string, CachedAccessToken>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asOptionalBoolean(value: unknown): boolean {
  return Boolean(value)
}

function formatDueDate(value: unknown): string | null {
  if (!isRecord(value)) return null
  const year = asOptionalNumber(value.year)
  const month = asOptionalNumber(value.month)
  const day = asOptionalNumber(value.day)
  if (
    year === null ||
    year === undefined ||
    month === null ||
    month === undefined ||
    day === null ||
    day === undefined
  )
    return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatDueTime(value: unknown): string | null {
  if (!isRecord(value)) return null
  const hours = asOptionalNumber(value.hours)
  const minutes = asOptionalNumber(value.minutes)
  if (hours === null || hours === undefined || minutes === null || minutes === undefined)
    return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function mapCourse(row: unknown): GoogleClassroomCourse | null {
  if (!isRecord(row)) return null
  const id = asOptionalString(row.id)
  const name = asOptionalString(row.name)
  if (!id || !name) return null
  return {
    id,
    name,
    section: asOptionalString(row.section),
    courseState: asOptionalString(row.courseState),
  }
}

function mapCourseWork(row: unknown): GoogleClassroomCourseWork | null {
  if (!isRecord(row)) return null
  const id = asOptionalString(row.id)
  const title = asOptionalString(row.title)
  if (!id || !title) return null
  return {
    id,
    title,
    description: asOptionalString(row.description),
    maxPoints: asOptionalNumber(row.maxPoints),
    state: asOptionalString(row.state),
    dueDate: formatDueDate(row.dueDate),
    dueTime: formatDueTime(row.dueTime),
  }
}

function mapStudentSubmission(row: unknown): GoogleClassroomStudentSubmission | null {
  if (!isRecord(row)) return null
  const id = asOptionalString(row.id)
  const userId = asOptionalString(row.userId)
  if (!id || !userId) return null
  return {
    id,
    userId,
    state: asOptionalString(row.state),
    assignedGrade: asOptionalNumber(row.assignedGrade),
    draftGrade: asOptionalNumber(row.draftGrade),
    late: asOptionalBoolean(row.late),
  }
}

function mapRosterMember(row: unknown): ClassroomRosterMember | null {
  if (!isRecord(row)) return null
  const profile = isRecord(row.profile) ? row.profile : null
  if (!profile) return null
  const userId = asOptionalString(profile.id)
  const email = asOptionalString(profile.emailAddress)
  if (!userId || !email) return null
  const name = isRecord(profile.name) ? asOptionalString(profile.name.fullName) : null
  return {
    googleUserId: userId,
    email: email.trim().toLowerCase(),
    fullName: name?.trim() || null,
  }
}

async function classroomFetch<T>(
  accessToken: string,
  path: string,
  query?: Record<string, string>,
  logCtx?: GoogleClassroomLogContext
): Promise<T> {
  const url = new URL(`${CLASSROOM_BASE}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }
  }

  gcLogDebug('Classroom API request', logCtx ?? {}, {
    method: 'GET',
    path,
    query: query ?? {},
  })

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const text = await response.text()
    let details: Array<{ reason?: string }> | undefined
    try {
      const parsed = JSON.parse(text)
      if (parsed?.error?.details && Array.isArray(parsed.error.details)) {
        details = parsed.error.details
      }
    } catch {
      // Ignore parse errors
    }
    const error = new ClassroomApiError(
      `Classroom API ${path} failed: ${response.status} ${text}`,
      response.status,
      details
    )
    gcLogError('Classroom API request failed', logCtx ?? {}, error, {
      path,
      status: response.status,
    })
    throw error
  }

  return (await response.json()) as T
}

async function listAllPages(
  accessToken: string,
  path: string,
  collectionKey: ClassroomCollectionKey,
  logCtx?: GoogleClassroomLogContext
): Promise<unknown[]> {
  const items: unknown[] = []
  let pageToken: string | undefined
  let pageNumber = 0

  do {
    pageNumber += 1
    const query: Record<string, string> = { pageSize: '100' }
    if (pageToken) query.pageToken = pageToken

    const page = await classroomFetch<ClassroomListResponse>(accessToken, path, query, logCtx)
    const chunk = page[collectionKey] ?? []
    items.push(...chunk)
    pageToken = page.nextPageToken

    gcLogDebug('Classroom API page fetched', logCtx ?? {}, {
      path,
      pageNumber,
      pageSize: chunk.length,
      hasNextPage: Boolean(pageToken),
    })
  } while (pageToken)

  return items
}

export async function getGoogleClassroomAccessToken(
  refreshToken: string,
  logCtx?: GoogleClassroomLogContext
): Promise<string> {
  const cached = accessTokenCache.get(refreshToken)
  const now = Date.now()
  if (cached && now < cached.expiresAtMs - ACCESS_TOKEN_EXPIRY_SKEW_MS) {
    gcLogDebug('Using cached Google access token', logCtx ?? {}, {
      expiresInSeconds: Math.floor((cached.expiresAtMs - now) / 1000),
    })
    return cached.accessToken
  }

  gcLogDebug('Refreshing Google access token', logCtx ?? {})
  const tokens = await refreshGoogleAccessToken(refreshToken)
  const expiresIn = tokens.expires_in ?? 3600
  accessTokenCache.set(refreshToken, {
    accessToken: tokens.access_token,
    expiresAtMs: Date.now() + expiresIn * 1000,
  })
  gcLogDebug('Google access token refreshed', logCtx ?? {}, {
    expiresIn,
    scopeCount: tokens.scope?.split(' ').length ?? 0,
  })
  return tokens.access_token
}

export function clearGoogleClassroomAccessTokenCache(): void {
  accessTokenCache.clear()
}

export async function listGoogleClassroomCourses(
  refreshToken: string
): Promise<GoogleClassroomCourse[]> {
  if (googleClassroomConfig.mockMode) {
    return MOCK_COURSES
  }

  const accessToken = await getGoogleClassroomAccessToken(refreshToken)
  const rows = await listAllPages(accessToken, '/courses', 'courses')
  const courses: GoogleClassroomCourse[] = []
  for (const row of rows) {
    const mapped = mapCourse(row)
    if (mapped) courses.push(mapped)
  }
  return courses
}

export async function listGoogleClassroomCourseWork(
  refreshToken: string,
  courseId: string
): Promise<GoogleClassroomCourseWork[]> {
  if (googleClassroomConfig.mockMode) {
    return mockCourseWorkForCourse(courseId)
  }

  const accessToken = await getGoogleClassroomAccessToken(refreshToken)
  const rows = await listAllPages(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/courseWork`,
    'courseWork'
  )
  const courseWork: GoogleClassroomCourseWork[] = []
  for (const row of rows) {
    const mapped = mapCourseWork(row)
    if (mapped) courseWork.push(mapped)
  }
  return courseWork
}

export interface PaginatedCourseWorkResult {
  courseWork: GoogleClassroomCourseWork[]
  nextPageToken: string | null
}

export async function listGoogleClassroomCourseWorkPaginated(
  refreshToken: string,
  courseId: string,
  options?: {
    pageSize?: number
    pageToken?: string
  }
): Promise<PaginatedCourseWorkResult> {
  const pageSize = options?.pageSize ?? 10
  const pageToken = options?.pageToken

  if (googleClassroomConfig.mockMode) {
    const allWork = mockCourseWorkForCourse(courseId)
    const start = pageToken ? Number.parseInt(pageToken, 10) : 0
    const end = start + pageSize
    const page = allWork.slice(start, end)
    const next = end < allWork.length ? String(end) : null
    return { courseWork: page, nextPageToken: next }
  }

  const query: Record<string, string> = {
    pageSize: String(pageSize),
    orderBy: 'updateTime desc',
    courseWorkStates: 'PUBLISHED',
  }
  if (pageToken) query.pageToken = pageToken

  let accessToken = await getGoogleClassroomAccessToken(refreshToken)
  const path = `/courses/${encodeURIComponent(courseId)}/courseWork`

  try {
    const response = await classroomFetch<ClassroomListResponse>(accessToken, path, query)
    const rows = response.courseWork ?? []
    const courseWork: GoogleClassroomCourseWork[] = []
    for (const row of rows) {
      const mapped = mapCourseWork(row)
      if (mapped) courseWork.push(mapped)
    }

    return {
      courseWork,
      nextPageToken: response.nextPageToken ?? null,
    }
  } catch (error) {
    if (error instanceof ClassroomApiError && error.status === 401) {
      accessTokenCache.delete(refreshToken)
      try {
        accessToken = await getGoogleClassroomAccessToken(refreshToken)
        const response = await classroomFetch<ClassroomListResponse>(accessToken, path, query)
        const rows = response.courseWork ?? []
        const courseWork: GoogleClassroomCourseWork[] = []
        for (const row of rows) {
          const mapped = mapCourseWork(row)
          if (mapped) courseWork.push(mapped)
        }

        return {
          courseWork,
          nextPageToken: response.nextPageToken ?? null,
        }
      } catch (retryError) {
        if (
          retryError instanceof Error &&
          (retryError.message.includes('invalid_grant') || retryError.message.includes('401'))
        ) {
          throw new ClassroomApiError('Token refresh failed with invalid_grant', 401)
        }
        throw retryError
      }
    }
    throw error
  }
}

export async function getGoogleClassroomCourseWork(
  refreshToken: string,
  courseId: string,
  courseWorkId: string
): Promise<GoogleClassroomCourseWork | null> {
  const items = await listGoogleClassroomCourseWork(refreshToken, courseId)
  return items.find((item) => item.id === courseWorkId) ?? null
}

export async function listGoogleClassroomCourseRoster(
  refreshToken: string,
  courseId: string,
  logCtx?: GoogleClassroomLogContext
): Promise<ClassroomRosterMember[]> {
  if (googleClassroomConfig.mockMode) {
    const members = listClassroomMockRosterForCourse(courseId).map((row) => ({
      googleUserId: row.googleUserId,
      email: row.email,
      fullName: row.fullName,
    }))
    gcLogInfo('Using mock Classroom course roster', logCtx ?? {}, {
      courseId,
      rosterCount: members.length,
      emails: members.map((row) => row.email),
    })
    return members
  }

  const accessToken = await getGoogleClassroomAccessToken(refreshToken, logCtx)
  const path = `/courses/${encodeURIComponent(courseId)}/students`

  gcLogInfo('Listing Classroom course students for roster sync', logCtx ?? {}, { path })

  const rows = await listAllPages(accessToken, path, 'students', logCtx)
  const members: ClassroomRosterMember[] = []
  for (const row of rows) {
    const mapped = mapRosterMember(row)
    if (mapped) members.push(mapped)
  }

  gcLogInfo('Classroom course roster resolved', logCtx ?? {}, {
    rosterCount: rows.length,
    resolvedEmailCount: members.length,
    emails: members.map((row) => row.email),
  })

  return members
}

export async function listGoogleClassroomStudentSubmissions(
  refreshToken: string,
  courseId: string,
  courseWorkId: string,
  logCtx?: GoogleClassroomLogContext
): Promise<GoogleClassroomStudentSubmission[]> {
  if (googleClassroomConfig.mockMode) {
    const mockRows = mockSubmissionsForCourseWork(courseWorkId)
    gcLogInfo('Using mock Classroom student submissions', logCtx ?? {}, {
      courseId,
      courseWorkId,
      count: mockRows.length,
      usedFallback: mockSubmissionsUsedFallback(courseWorkId),
      fixtureEmails: mockRows.map((row) => row.userId),
    })
    return mockRows
  }

  const accessToken = await getGoogleClassroomAccessToken(refreshToken, logCtx)
  const path = `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions`

  gcLogInfo('Listing Classroom student submissions', logCtx ?? {}, { path })

  const rows = await listAllPages(accessToken, path, 'studentSubmissions', logCtx)
  const mapped: GoogleClassroomStudentSubmission[] = []
  for (const row of rows) {
    const item = mapStudentSubmission(row)
    if (item) mapped.push(item)
  }

  gcLogInfo('Classroom student submissions mapped', logCtx ?? {}, {
    rawCount: rows.length,
    mappedCount: mapped.length,
    submissions: mapped.map((row) => ({
      submissionId: row.id,
      userId: row.userId,
      assignedGrade: row.assignedGrade,
      draftGrade: row.draftGrade,
      state: row.state,
    })),
  })

  return mapped
}

export async function buildClassroomGradeMaps(input: {
  refreshToken: string
  courseId: string
  courseWorkId: string
  logCtx?: GoogleClassroomLogContext
}): Promise<ClassroomGradeMaps> {
  const submissions = await listGoogleClassroomStudentSubmissions(
    input.refreshToken,
    input.courseId,
    input.courseWorkId,
    input.logCtx
  )

  const roster = googleClassroomConfig.mockMode
    ? listClassroomMockRosterForCourse(input.courseId)
    : await listGoogleClassroomCourseRoster(input.refreshToken, input.courseId, input.logCtx)

  const maps = buildGradeMapsFromSubmissions({
    submissions,
    roster,
    mockMode: googleClassroomConfig.mockMode,
  })

  if (!googleClassroomConfig.mockMode && maps.unresolvedUserIds > 0) {
    gcLogWarn(
      'Some Classroom submission userIds could not be mapped to email',
      input.logCtx ?? {},
      {
        unresolvedUserIds: maps.unresolvedUserIds,
        rosterSize: maps.emailByUserId.size,
      }
    )
  }

  return {
    gradeByEmail: maps.gradeByEmail,
    gradeByGoogleUserId: maps.gradeByGoogleUserId,
    emailByUserId: maps.emailByUserId,
  }
}
