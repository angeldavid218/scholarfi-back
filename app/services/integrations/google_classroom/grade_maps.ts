import type {
  ClassroomGradeMaps,
  ClassroomRosterMember,
  GoogleClassroomStudentSubmission,
} from '#services/integrations/google_classroom/types'

export interface ResolveClassroomGradeForUserInput {
  email: string
  googleClassroomUserId: string | null
  gradeByEmail: Map<string, number | null>
  gradeByGoogleUserId: Map<string, number | null>
}

export interface ResolvedClassroomGrade {
  grade: number | null | undefined
  gradeFound: boolean
  lookupKey: string
}

export interface BuildGradeMapsInput {
  submissions: GoogleClassroomStudentSubmission[]
  roster: ClassroomRosterMember[]
  mockMode: boolean
}

export interface BuildGradeMapsResult extends ClassroomGradeMaps {
  unresolvedUserIds: number
}

/** True when Classroom returns a numeric user id instead of an email. */
export function isLikelyClassroomNumericUserId(userId: string): boolean {
  return /^\d+$/.test(userId.trim())
}

export function resolveSubmissionGrade(
  submission: GoogleClassroomStudentSubmission
): number | null {
  if (submission.assignedGrade !== null && submission.assignedGrade !== undefined)
    return submission.assignedGrade
  if (submission.draftGrade !== null && submission.draftGrade !== undefined)
    return submission.draftGrade
  return null
}

/** Normalize GC userId (email or numeric id) to lowercase email when possible. */
export function normalizeClassroomUserKey(userId: string): string {
  return userId.trim().toLowerCase()
}

export function resolveClassroomGradeForUser(
  input: ResolveClassroomGradeForUserInput
): ResolvedClassroomGrade {
  const userKey = input.email.trim().toLowerCase()
  const googleId = input.googleClassroomUserId?.trim() || null

  if (googleId && !googleId.includes('@') && input.gradeByGoogleUserId.has(googleId)) {
    return {
      grade: input.gradeByGoogleUserId.get(googleId),
      gradeFound: true,
      lookupKey: `google:${googleId}`,
    }
  }

  return {
    grade: input.gradeByEmail.get(userKey),
    gradeFound: input.gradeByEmail.has(userKey),
    lookupKey: userKey,
  }
}

export function buildGradeMapsFromSubmissions(input: BuildGradeMapsInput): BuildGradeMapsResult {
  const gradeByEmail = new Map<string, number | null>()
  const gradeByGoogleUserId = new Map<string, number | null>()
  const emailByUserId = new Map<string, string>()

  if (input.mockMode) {
    for (const submission of input.submissions) {
      const grade = resolveSubmissionGrade(submission)
      const key = normalizeClassroomUserKey(submission.userId)
      // Mock submissions use email as userId — grades are keyed by email only.
      gradeByEmail.set(key, grade)
    }

    // After "Sincronizar estudiantes", users store mock google_classroom_user_id
    // (gc-user-...). Index the same grades by that id so reward sync still matches.
    // Do not put emails into emailByUserId — persist treats keys as Google profile ids.
    for (const member of input.roster) {
      const email = member.email.trim().toLowerCase()
      emailByUserId.set(member.googleUserId, email)
      if (gradeByEmail.has(email)) {
        gradeByGoogleUserId.set(member.googleUserId, gradeByEmail.get(email) ?? null)
      }
    }

    return { gradeByEmail, gradeByGoogleUserId, emailByUserId, unresolvedUserIds: 0 }
  }

  for (const member of input.roster) {
    emailByUserId.set(member.googleUserId, member.email)
  }

  let unresolvedUserIds = 0

  for (const submission of input.submissions) {
    const grade = resolveSubmissionGrade(submission)
    let email: string | undefined

    if (isLikelyClassroomNumericUserId(submission.userId)) {
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

  return { gradeByEmail, gradeByGoogleUserId, emailByUserId, unresolvedUserIds }
}
