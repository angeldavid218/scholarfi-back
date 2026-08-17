import googleClassroomConfig from '#config/google_classroom'
import {
  CLASSROOM_MOCK_STUDENT_GRADES,
  listClassroomMockRosterForCourse,
} from '#fixtures/demo_students'
import {
  gcLogDebug,
  gcLogError,
  gcLogInfo,
  gcLogWarn,
  type GoogleClassroomLogContext,
} from '#services/integrations/google_classroom/logger'
import { refreshGoogleAccessToken } from '#services/integrations/google_classroom/oauth_service'
import type {
  GoogleClassroomCourse,
  GoogleClassroomCourseWork,
  GoogleClassroomStudentSubmission,
} from '#services/integrations/google_classroom/types'

export { CLASSROOM_MOCK_STUDENT_GRADES } from '#fixtures/demo_students'

const CLASSROOM_BASE = 'https://classroom.googleapis.com/v1'
const ACCESS_TOKEN_EXPIRY_SKEW_MS = 60_000

type CachedAccessToken = {
  accessToken: string
  expiresAtMs: number
}

const accessTokenCache = new Map<string, CachedAccessToken>()

export type ClassroomGradeMaps = {
  gradeByEmail: Map<string, number | null>
  gradeByGoogleUserId: Map<string, number | null>
  emailByUserId: Map<string, string>
}

type ClassroomListResponse<T> = {
  courseWork?: T[]
  studentSubmissions?: T[]
  courses?: T[]
  students?: T[]
  nextPageToken?: string
}


const MOCK_COURSES: GoogleClassroomCourse[] = [
  { id: 'gc-course-1', name: 'Matematicas 3A', section: '3A', courseState: 'ACTIVE' },
  { id: 'gc-course-2', name: 'Ciencias 3A', section: '3A', courseState: 'ACTIVE' },
]

/** Five published items on course-1 so import-all + sync-all can unlock the first-5 milestone. */
const MOCK_COURSEWORK: Record<string, GoogleClassroomCourseWork[]> = {
  'gc-course-1': [
    {
      id: 'gc-work-1',
      title: 'Ecuaciones lineales',
      description: 'Resolver ejercicios del capitulo 4',
      maxPoints: 10,
      state: 'PUBLISHED',
      dueDate: '2026-07-15',
      dueTime: null,
    },
    {
      id: 'gc-work-2',
      title: 'Repaso unidad 2',
      description: 'Actividad de repaso',
      maxPoints: 10,
      state: 'PUBLISHED',
      dueDate: null,
      dueTime: null,
    },
    {
      id: 'gc-work-3',
      title: 'Problemas de fracciones',
      description: 'Serie de ejercicios de fracciones equivalentes',
      maxPoints: 10,
      state: 'PUBLISHED',
      dueDate: null,
      dueTime: null,
    },
    {
      id: 'gc-work-4',
      title: 'Geometria basica',
      description: 'Perimetro y area de figuras planas',
      maxPoints: 10,
      state: 'PUBLISHED',
      dueDate: null,
      dueTime: null,
    },
    {
      id: 'gc-work-5',
      title: 'Quiz diagnostico',
      description: 'Evaluacion corta de conceptos previos',
      maxPoints: 10,
      state: 'PUBLISHED',
      dueDate: null,
      dueTime: null,
    },
  ],
  'gc-course-2': [
    {
      id: 'gc-work-6',
      title: 'Laboratorio virtual',
      description: 'Informe de laboratorio',
      maxPoints: 10,
      state: 'PUBLISHED',
      dueDate: null,
      dueTime: null,
    },
  ],
}

const MOCK_SUBMISSIONS: Record<string, GoogleClassroomStudentSubmission[]> = Object.fromEntries(
  ['gc-work-1', 'gc-work-2', 'gc-work-3', 'gc-work-4', 'gc-work-5', 'gc-work-6'].map(
    (courseWorkId) => [
      courseWorkId,
      CLASSROOM_MOCK_STUDENT_GRADES.map((row, index) => ({
        id: `gc-sub-${courseWorkId}-${index}`,
        userId: row.email,
        state: 'TURNED_IN' as const,
        assignedGrade: row.assignedGrade,
        draftGrade: null,
        late: false,
      })),
    ]
  )
)

function mockSubmissionsForCourseWork(courseWorkId: string): GoogleClassroomStudentSubmission[] {
  const specific = MOCK_SUBMISSIONS[courseWorkId]
  if (specific && specific.length > 0) {
    return specific
  }

  return CLASSROOM_MOCK_STUDENT_GRADES.map((row, index) => ({
    id: `gc-sub-fallback-${courseWorkId}-${index}`,
    userId: row.email,
    state: 'TURNED_IN',
    assignedGrade: row.assignedGrade,
    draftGrade: null,
    late: false,
  }))
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
    const error = new Error(`Classroom API ${path} failed: ${response.status} ${text}`)
    gcLogError('Classroom API request failed', logCtx ?? {}, error, {
      path,
      status: response.status,
    })
    throw error
  }

  const body = (await response.json()) as T
  gcLogDebug('Classroom API request succeeded', logCtx ?? {}, { path })
  return body
}

async function listAllPages<TItem>(
  accessToken: string,
  path: string,
  collectionKey: 'courses' | 'courseWork' | 'studentSubmissions' | 'students',
  logCtx?: GoogleClassroomLogContext
): Promise<TItem[]> {
  const items: TItem[] = []
  let pageToken: string | undefined
  let pageNumber = 0

  do {
    pageNumber += 1
    const query: Record<string, string> = { pageSize: '100' }
    if (pageToken) query.pageToken = pageToken

    const page = await classroomFetch<ClassroomListResponse<TItem>>(accessToken, path, query, logCtx)
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
  try {
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
  } catch (error) {
    accessTokenCache.delete(refreshToken)
    gcLogError('Google access token refresh failed', logCtx ?? {}, error)
    throw error
  }
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
  const rows = await listAllPages<{
    id?: string
    name?: string
    section?: string
    courseState?: string
  }>(accessToken, '/courses', 'courses')

  return rows
    .filter((row) => row.id && row.name)
    .map((row) => ({
      id: row.id!,
      name: row.name!,
      section: row.section ?? null,
      courseState: row.courseState ?? null,
    }))
}

export async function listGoogleClassroomCourseWork(
  refreshToken: string,
  courseId: string
): Promise<GoogleClassroomCourseWork[]> {
  if (googleClassroomConfig.mockMode) {
    return MOCK_COURSEWORK[courseId] ?? []
  }

  const accessToken = await getGoogleClassroomAccessToken(refreshToken)
  const rows = await listAllPages<{
    id?: string
    title?: string
    description?: string
    maxPoints?: number
    state?: string
    dueDate?: { year?: number; month?: number; day?: number }
    dueTime?: { hours?: number; minutes?: number }
  }>(accessToken, `/courses/${encodeURIComponent(courseId)}/courseWork`, 'courseWork')

  return rows
    .filter((row) => row.id && row.title)
    .map((row) => ({
      id: row.id!,
      title: row.title!,
      description: row.description ?? null,
      maxPoints: row.maxPoints ?? null,
      state: row.state ?? null,
      dueDate:
        row.dueDate?.year && row.dueDate.month && row.dueDate.day
          ? `${row.dueDate.year}-${String(row.dueDate.month).padStart(2, '0')}-${String(row.dueDate.day).padStart(2, '0')}`
          : null,
      dueTime:
        row.dueTime?.hours != null && row.dueTime.minutes != null
          ? `${String(row.dueTime.hours).padStart(2, '0')}:${String(row.dueTime.minutes).padStart(2, '0')}`
          : null,
    }))
}

export async function getGoogleClassroomCourseWork(
  refreshToken: string,
  courseId: string,
  courseWorkId: string
): Promise<GoogleClassroomCourseWork | null> {
  const items = await listGoogleClassroomCourseWork(refreshToken, courseId)
  return items.find((item) => item.id === courseWorkId) ?? null
}

export type ClassroomRosterMember = {
  googleUserId: string
  email: string
  fullName: string | null
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

  const rows = await listAllPages<{
    profile?: {
      id?: string
      emailAddress?: string
      name?: { fullName?: string }
    }
  }>(accessToken, path, 'students', logCtx)

  const members: ClassroomRosterMember[] = []
  for (const row of rows) {
    const userId = row.profile?.id
    const email = row.profile?.emailAddress
    if (!userId || !email) continue
    const fullName = row.profile?.name?.fullName?.trim() || null
    members.push({
      googleUserId: userId,
      email: email.trim().toLowerCase(),
      fullName,
    })
  }

  gcLogInfo('Classroom course roster resolved', logCtx ?? {}, {
    rosterCount: rows.length,
    resolvedEmailCount: members.length,
    emails: members.map((row) => row.email),
  })

  return members
}

export async function listGoogleClassroomCourseStudentEmails(
  refreshToken: string,
  courseId: string,
  logCtx?: GoogleClassroomLogContext
): Promise<Map<string, string>> {
  const roster = await listGoogleClassroomCourseRoster(refreshToken, courseId, logCtx)
  const emailByUserId = new Map<string, string>()
  for (const member of roster) {
    emailByUserId.set(member.googleUserId, member.email)
  }
  return emailByUserId
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

  const gradeByEmail = new Map<string, number | null>()
  const gradeByGoogleUserId = new Map<string, number | null>()
  const emailByUserId = new Map<string, string>()

  if (googleClassroomConfig.mockMode) {
    for (const submission of submissions) {
      const grade = resolveSubmissionGrade(submission)
      const key = normalizeClassroomUserKey(submission.userId)
      gradeByEmail.set(key, grade)
      if (/^\d+$/.test(submission.userId.trim())) {
        gradeByGoogleUserId.set(submission.userId.trim(), grade)
      }
    }
    return { gradeByEmail, gradeByGoogleUserId, emailByUserId }
  }

  const rosterEmails = await listGoogleClassroomCourseStudentEmails(
    input.refreshToken,
    input.courseId,
    input.logCtx
  )
  for (const [userId, email] of rosterEmails) {
    emailByUserId.set(userId, email)
  }

  let unresolvedUserIds = 0

  for (const submission of submissions) {
    const grade = resolveSubmissionGrade(submission)
    let email: string | undefined

    if (/^\d+$/.test(submission.userId.trim())) {
      gradeByGoogleUserId.set(submission.userId.trim(), grade)
      email = emailByUserId.get(submission.userId)
      if (!email) unresolvedUserIds += 1
    } else {
      email = normalizeClassroomUserKey(submission.userId)
    }

    if (email) {
      gradeByEmail.set(normalizeClassroomUserKey(email), grade)
    }
  }

  if (unresolvedUserIds > 0) {
    gcLogWarn('Some Classroom submission userIds could not be mapped to email', input.logCtx ?? {}, {
      unresolvedUserIds,
      rosterSize: emailByUserId.size,
    })
  }

  return { gradeByEmail, gradeByGoogleUserId, emailByUserId }
}

export async function listGoogleClassroomStudentSubmissions(
  refreshToken: string,
  courseId: string,
  courseWorkId: string,
  logCtx?: GoogleClassroomLogContext
): Promise<GoogleClassroomStudentSubmission[]> {
  if (googleClassroomConfig.mockMode) {
    const mockRows = mockSubmissionsForCourseWork(courseWorkId)
    const usedFallback = !MOCK_SUBMISSIONS[courseWorkId]?.length
    gcLogInfo('Using mock Classroom student submissions', logCtx ?? {}, {
      courseId,
      courseWorkId,
      count: mockRows.length,
      usedFallback,
      fixtureEmails: mockRows.map((row) => row.userId),
    })
    return mockRows
  }

  const accessToken = await getGoogleClassroomAccessToken(refreshToken, logCtx)
  const path = `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions`

  gcLogInfo('Listing Classroom student submissions', logCtx ?? {}, { path })

  const rows = await listAllPages<{
    id?: string
    userId?: string
    state?: string
    assignedGrade?: number
    draftGrade?: number
    late?: boolean
  }>(accessToken, path, 'studentSubmissions', logCtx)

  const mapped = rows
    .filter((row) => row.id && row.userId)
    .map((row) => ({
      id: row.id!,
      userId: row.userId!,
      state: row.state ?? null,
      assignedGrade: row.assignedGrade ?? null,
      draftGrade: row.draftGrade ?? null,
      late: Boolean(row.late),
    }))

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

export function resolveSubmissionGrade(
  submission: GoogleClassroomStudentSubmission
): number | null {
  if (submission.assignedGrade != null) return submission.assignedGrade
  if (submission.draftGrade != null) return submission.draftGrade
  return null
}

/** Normalize GC userId (email or numeric id) to lowercase email when possible. */
export function normalizeClassroomUserKey(userId: string): string {
  return userId.trim().toLowerCase()
}

export function resolveClassroomGradeForUser(input: {
  email: string
  googleClassroomUserId: string | null
  gradeByEmail: Map<string, number | null>
  gradeByGoogleUserId: Map<string, number | null>
}): { grade: number | null | undefined; gradeFound: boolean; lookupKey: string } {
  const googleId = input.googleClassroomUserId?.trim() || null
  if (googleId && input.gradeByGoogleUserId.has(googleId)) {
    return {
      grade: input.gradeByGoogleUserId.get(googleId),
      gradeFound: true,
      lookupKey: `google:${googleId}`,
    }
  }

  const userKey = input.email.trim().toLowerCase()
  return {
    grade: input.gradeByEmail.get(userKey),
    gradeFound: input.gradeByEmail.has(userKey),
    lookupKey: userKey,
  }
}
