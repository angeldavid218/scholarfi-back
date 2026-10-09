import {
  buildGradeMapsFromSubmissions,
  resolveClassroomGradeForUser,
  resolveSubmissionGrade,
} from '#services/integrations/google_classroom/grade_maps'
import type {
  ClassroomRosterMember,
  GoogleClassroomStudentSubmission,
} from '#services/integrations/google_classroom/types'
import { test } from '@japa/runner'

function submission(
  overrides: Partial<GoogleClassroomStudentSubmission> &
    Pick<GoogleClassroomStudentSubmission, 'id' | 'userId'>
): GoogleClassroomStudentSubmission {
  return {
    state: 'TURNED_IN',
    assignedGrade: null,
    draftGrade: null,
    late: false,
    ...overrides,
  }
}

test.group('Google Classroom grade maps', () => {
  test('resolveClassroomGradeForUser prefers google user id over email', ({ assert }) => {
    const gradeByEmail = new Map<string, number | null>([['student@school.edu', 4]])
    const gradeByGoogleUserId = new Map<string, number | null>([['100800854909300885323', 9]])

    const byGoogle = resolveClassroomGradeForUser({
      email: 'student@school.edu',
      googleClassroomUserId: '100800854909300885323',
      gradeByEmail,
      gradeByGoogleUserId,
    })
    assert.isTrue(byGoogle.gradeFound)
    assert.equal(byGoogle.grade, 9)
    assert.equal(byGoogle.lookupKey, 'google:100800854909300885323')

    const byEmail = resolveClassroomGradeForUser({
      email: 'student@school.edu',
      googleClassroomUserId: null,
      gradeByEmail,
      gradeByGoogleUserId,
    })
    assert.isTrue(byEmail.gradeFound)
    assert.equal(byEmail.grade, 4)
    assert.equal(byEmail.lookupKey, 'student@school.edu')

    const missing = resolveClassroomGradeForUser({
      email: 'other@school.edu',
      googleClassroomUserId: '999',
      gradeByEmail,
      gradeByGoogleUserId,
    })
    assert.isFalse(missing.gradeFound)
    assert.isUndefined(missing.grade)

    const emailShapedGoogleId = resolveClassroomGradeForUser({
      email: 'student@school.edu',
      googleClassroomUserId: 'student@school.edu',
      gradeByEmail,
      gradeByGoogleUserId,
    })
    assert.isTrue(emailShapedGoogleId.gradeFound)
    assert.equal(emailShapedGoogleId.grade, 4)
    assert.equal(emailShapedGoogleId.lookupKey, 'student@school.edu')
  })

  test('resolveClassroomGradeForUser finds mock fixture grades via gc-user id', ({ assert }) => {
    const email = 'sofia.hernandez@scholarfi.test'
    const googleId = 'gc-user-sofia-hernandez-scholarfi-test'
    const gradeByEmail = new Map<string, number | null>([[email, 8]])
    const gradeByGoogleUserId = new Map<string, number | null>([[googleId, 8]])

    const resolved = resolveClassroomGradeForUser({
      email,
      googleClassroomUserId: googleId,
      gradeByEmail,
      gradeByGoogleUserId,
    })
    assert.isTrue(resolved.gradeFound)
    assert.equal(resolved.grade, 8)
    assert.equal(resolved.lookupKey, `google:${googleId}`)
  })

  test('resolveSubmissionGrade prefers assigned grade then draft grade', ({ assert }) => {
    assert.equal(
      resolveSubmissionGrade(submission({ id: '1', userId: 'a', assignedGrade: 9, draftGrade: 2 })),
      9
    )
    assert.equal(
      resolveSubmissionGrade(
        submission({ id: '2', userId: 'a', assignedGrade: null, draftGrade: 7 })
      ),
      7
    )
    assert.isNull(resolveSubmissionGrade(submission({ id: '3', userId: 'a' })))
  })

  test('live maps index numeric user ids and resolve email from roster', ({ assert }) => {
    const roster: ClassroomRosterMember[] = [
      { googleUserId: '100800854909300885323', email: 'student@school.edu', fullName: 'Student' },
    ]
    const maps = buildGradeMapsFromSubmissions({
      mockMode: false,
      roster,
      submissions: [
        submission({
          id: 'sub-1',
          userId: '100800854909300885323',
          assignedGrade: 9,
        }),
        submission({
          id: 'sub-2',
          userId: 'other@school.edu',
          assignedGrade: 4,
        }),
      ],
    })

    assert.equal(maps.gradeByGoogleUserId.get('100800854909300885323'), 9)
    assert.equal(maps.gradeByEmail.get('student@school.edu'), 9)
    assert.equal(maps.gradeByEmail.get('other@school.edu'), 4)
    assert.equal(maps.emailByUserId.get('100800854909300885323'), 'student@school.edu')
    assert.equal(maps.unresolvedUserIds, 0)
  })

  test('mock maps index email userIds and gc-user roster ids', ({ assert }) => {
    const email = 'sofia.hernandez@scholarfi.test'
    const googleId = 'gc-user-sofia-hernandez-scholarfi-test'
    const roster: ClassroomRosterMember[] = [{ googleUserId: googleId, email, fullName: 'Sofia' }]
    const maps = buildGradeMapsFromSubmissions({
      mockMode: true,
      roster,
      submissions: [submission({ id: 'gc-sub-1', userId: email, assignedGrade: 8 })],
    })

    assert.equal(maps.gradeByEmail.get(email), 8)
    assert.equal(maps.gradeByGoogleUserId.get(googleId), 8)
    assert.equal(maps.emailByUserId.get(googleId), email)
    assert.isUndefined(maps.emailByUserId.get(email))

    const resolved = resolveClassroomGradeForUser({
      email,
      googleClassroomUserId: googleId,
      gradeByEmail: maps.gradeByEmail,
      gradeByGoogleUserId: maps.gradeByGoogleUserId,
    })
    assert.equal(resolved.grade, 8)
    assert.equal(resolved.lookupKey, `google:${googleId}`)
  })
})
