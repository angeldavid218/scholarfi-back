import {
  clearGoogleClassroomAccessTokenCache,
  getGoogleClassroomAccessToken,
  resolveClassroomGradeForUser,
} from '#services/integrations/google_classroom/client'
import { test } from '@japa/runner'

test.group('Google Classroom client helpers', () => {
  test('getGoogleClassroomAccessToken reuses cached token within expiry window', async ({
    assert,
  }) => {
    clearGoogleClassroomAccessTokenCache()
    let refreshCount = 0
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        refreshCount += 1
        return new Response(
          JSON.stringify({
            access_token: `token-${refreshCount}`,
            expires_in: 3599,
            scope: 'scope-a scope-b',
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      throw new Error(`Unexpected fetch in test: ${url}`)
    }) as typeof fetch

    try {
      const first = await getGoogleClassroomAccessToken('refresh-cache-1')
      const second = await getGoogleClassroomAccessToken('refresh-cache-1')
      assert.equal(first, 'token-1')
      assert.equal(second, 'token-1')
      assert.equal(refreshCount, 1)
    } finally {
      globalThis.fetch = originalFetch
      clearGoogleClassroomAccessTokenCache()
    }
  })

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
    const email = 'mateo.vargas@scholarfi.test'
    const googleId = 'gc-user-mateo-vargas-scholarfi-test'
    const gradeByEmail = new Map<string, number | null>([[email, 5]])
    const gradeByGoogleUserId = new Map<string, number | null>([[googleId, 5]])

    const resolved = resolveClassroomGradeForUser({
      email,
      googleClassroomUserId: googleId,
      gradeByEmail,
      gradeByGoogleUserId,
    })
    assert.isTrue(resolved.gradeFound)
    assert.equal(resolved.grade, 5)
    assert.equal(resolved.lookupKey, `google:${googleId}`)
  })
})
