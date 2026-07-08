import googleClassroomConfig from '#config/google_classroom'
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

const CLASSROOM_BASE = 'https://classroom.googleapis.com/v1'

type ClassroomListResponse<T> = {
  courseWork?: T[]
  studentSubmissions?: T[]
  courses?: T[]
  students?: T[]
  nextPageToken?: string
}

/** Default grade fixtures used when mock mode is on (any courseWorkId). */
export const CLASSROOM_MOCK_STUDENT_GRADES = [
  { email: 'student-alpha@school.edu', assignedGrade: 8 as number | null },
  { email: 'student-beta@school.edu', assignedGrade: 5 as number | null },
  { email: 'student-gamma@school.edu', assignedGrade: null as number | null },
  { email: 'demo.student1@scholarfi.test', assignedGrade: 8 as number | null },
  { email: 'demo.student2@scholarfi.test', assignedGrade: 5 as number | null },
] as const

const MOCK_COURSES: GoogleClassroomCourse[] = [
  { id: 'gc-course-1', name: 'Matematicas 3A', section: '3A', courseState: 'ACTIVE' },
  { id: 'gc-course-2', name: 'Ciencias 3A', section: '3A', courseState: 'ACTIVE' },
]

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
  ],
  'gc-course-2': [
    {
      id: 'gc-work-3',
      title: 'Laboratorio virtual',
      description: 'Informe de laboratorio',
      maxPoints: 10,
      state: 'PUBLISHED',
      dueDate: null,
      dueTime: null,
    },
  ],
}

const MOCK_SUBMISSIONS: Record<string, GoogleClassroomStudentSubmission[]> = {
  'gc-work-1': CLASSROOM_MOCK_STUDENT_GRADES.map((row, index) => ({
    id: `gc-sub-1-${index}`,
    userId: row.email,
    state: 'TURNED_IN',
    assignedGrade: row.assignedGrade,
    draftGrade: null,
    late: false,
  })),
}

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
  gcLogDebug('Refreshing Google access token', logCtx ?? {})
  try {
    const tokens = await refreshGoogleAccessToken(refreshToken)
    gcLogDebug('Google access token refreshed', logCtx ?? {}, {
      expiresIn: tokens.expires_in,
      scopeCount: tokens.scope?.split(' ').length ?? 0,
    })
    return tokens.access_token
  } catch (error) {
    gcLogError('Google access token refresh failed', logCtx ?? {}, error)
    throw error
  }
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

export async function listGoogleClassroomCourseStudentEmails(
  refreshToken: string,
  courseId: string,
  logCtx?: GoogleClassroomLogContext
): Promise<Map<string, string>> {
  const accessToken = await getGoogleClassroomAccessToken(refreshToken, logCtx)
  const path = `/courses/${encodeURIComponent(courseId)}/students`

  gcLogInfo('Listing Classroom course students for email resolution', logCtx ?? {}, { path })

  const rows = await listAllPages<{
    profile?: { id?: string; emailAddress?: string }
  }>(accessToken, path, 'students', logCtx)

  const emailByUserId = new Map<string, string>()
  for (const row of rows) {
    const userId = row.profile?.id
    const email = row.profile?.emailAddress
    if (userId && email) {
      emailByUserId.set(userId, email.trim().toLowerCase())
    }
  }

  gcLogInfo('Classroom course student emails resolved', logCtx ?? {}, {
    rosterCount: rows.length,
    resolvedEmailCount: emailByUserId.size,
    emails: [...emailByUserId.values()],
  })

  return emailByUserId
}

export async function buildClassroomGradeByEmailMap(input: {
  refreshToken: string
  courseId: string
  courseWorkId: string
  logCtx?: GoogleClassroomLogContext
}): Promise<Map<string, number | null>> {
  const submissions = await listGoogleClassroomStudentSubmissions(
    input.refreshToken,
    input.courseId,
    input.courseWorkId,
    input.logCtx
  )

  const gradeByEmail = new Map<string, number | null>()

  if (googleClassroomConfig.mockMode) {
    for (const submission of submissions) {
      gradeByEmail.set(normalizeClassroomUserKey(submission.userId), resolveSubmissionGrade(submission))
    }
    return gradeByEmail
  }

  const emailByUserId = await listGoogleClassroomCourseStudentEmails(
    input.refreshToken,
    input.courseId,
    input.logCtx
  )

  let unresolvedUserIds = 0

  for (const submission of submissions) {
    const grade = resolveSubmissionGrade(submission)
    let email: string | undefined

    if (/^\d+$/.test(submission.userId.trim())) {
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

  return gradeByEmail
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
