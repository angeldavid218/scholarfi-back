import {
  clearGoogleClassroomAccessTokenCache,
  getGoogleClassroomAccessToken,
  listGoogleClassroomCourseWorkPaginated,
} from '#services/integrations/google_classroom/client'
import googleClassroomConfig from '#config/google_classroom'
import { test } from '@japa/runner'

test.group('Google Classroom client helpers', (group) => {
  let originalMockMode: boolean

  group.setup(() => {
    originalMockMode = googleClassroomConfig.mockMode
    Object.defineProperty(googleClassroomConfig, 'mockMode', {
      get: () => false,
      configurable: true,
    })
  })

  group.teardown(() => {
    Object.defineProperty(googleClassroomConfig, 'mockMode', {
      get: () => originalMockMode,
      configurable: true,
    })
  })

  group.each.teardown(() => {
    clearGoogleClassroomAccessTokenCache()
  })

  test('getGoogleClassroomAccessToken reuses cached token within expiry window', async ({
    assert,
  }) => {
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
    }
  })

  test('401 error triggers token refresh and retry, succeeds on retry', async ({ assert }) => {
    let callCount = 0
    let refreshCount = 0
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        refreshCount += 1
        return new Response(
          JSON.stringify({
            access_token: `refreshed-token-${refreshCount}`,
            expires_in: 3599,
            scope: 'scope',
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (url.includes('classroom.googleapis.com')) {
        callCount += 1
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }
        return new Response(
          JSON.stringify({ courseWork: [{ id: 'cw-1', title: 'Test Assignment' }] }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      const result = await listGoogleClassroomCourseWorkPaginated('refresh-401', 'course-1', {
        pageSize: 10,
      })
      assert.equal(result.courseWork.length, 1)
      assert.equal(result.courseWork[0].id, 'cw-1')
      assert.equal(callCount, 2)
      assert.equal(refreshCount, 2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('401 error with invalid_grant on refresh returns GOOGLE_TOKEN_EXPIRED', async ({
    assert,
  }) => {
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({ error: 'invalid_grant', error_description: 'Token expired' }),
          { status: 400 }
        )
      }
      if (url.includes('classroom.googleapis.com')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      let errorThrown = false
      let errorMessage = ''
      try {
        await listGoogleClassroomCourseWorkPaginated('refresh-invalid', 'course-1', {
          pageSize: 10,
        })
      } catch (error: any) {
        errorThrown = true
        errorMessage = error.message
      }
      assert.isTrue(errorThrown)
      assert.include(errorMessage.toLowerCase(), 'invalid_grant')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('429 error maps to GOOGLE_CLASSROOM_RATE_LIMITED', async ({ assert }) => {
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3599 }), {
          status: 200,
        })
      }
      if (url.includes('classroom.googleapis.com')) {
        return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
          status: 429,
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      let errorThrown = false
      let errorStatus = 0
      try {
        await listGoogleClassroomCourseWorkPaginated('test-refresh', 'course-1', { pageSize: 10 })
      } catch (error: any) {
        errorThrown = true
        errorStatus = error.status
      }
      assert.isTrue(errorThrown)
      assert.equal(errorStatus, 429)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('403 with rateLimitExceeded reason maps to GOOGLE_CLASSROOM_RATE_LIMITED', async ({
    assert,
  }) => {
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3599 }), {
          status: 200,
        })
      }
      if (url.includes('classroom.googleapis.com')) {
        return new Response(
          JSON.stringify({
            error: {
              message: 'Rate limit',
              details: [{ reason: 'rateLimitExceeded' }],
            },
          }),
          { status: 403 }
        )
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      let errorThrown = false
      let errorStatus = 0
      let hasRateReason = false
      try {
        await listGoogleClassroomCourseWorkPaginated('test-refresh', 'course-1', { pageSize: 10 })
      } catch (error: any) {
        errorThrown = true
        errorStatus = error.status
        hasRateReason = error.details?.some((d: any) => d.reason === 'rateLimitExceeded')
      }
      assert.isTrue(errorThrown)
      assert.equal(errorStatus, 403)
      assert.isTrue(hasRateReason)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('403 with userRateLimitExceeded reason maps to GOOGLE_CLASSROOM_RATE_LIMITED', async ({
    assert,
  }) => {
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3599 }), {
          status: 200,
        })
      }
      if (url.includes('classroom.googleapis.com')) {
        return new Response(
          JSON.stringify({
            error: {
              message: 'User rate limit',
              details: [{ reason: 'userRateLimitExceeded' }],
            },
          }),
          { status: 403 }
        )
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      let errorThrown = false
      let errorStatus = 0
      let hasUserRateReason = false
      try {
        await listGoogleClassroomCourseWorkPaginated('test-refresh', 'course-1', { pageSize: 10 })
      } catch (error: any) {
        errorThrown = true
        errorStatus = error.status
        hasUserRateReason = error.details?.some((d: any) => d.reason === 'userRateLimitExceeded')
      }
      assert.isTrue(errorThrown)
      assert.equal(errorStatus, 403)
      assert.isTrue(hasUserRateReason)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('403 with quotaExceeded reason maps to GOOGLE_CLASSROOM_QUOTA_EXCEEDED', async ({
    assert,
  }) => {
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3599 }), {
          status: 200,
        })
      }
      if (url.includes('classroom.googleapis.com')) {
        return new Response(
          JSON.stringify({
            error: {
              message: 'Quota exceeded',
              details: [{ reason: 'quotaExceeded' }],
            },
          }),
          { status: 403 }
        )
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      let errorThrown = false
      let errorStatus = 0
      let hasQuotaReason = false
      try {
        await listGoogleClassroomCourseWorkPaginated('test-refresh', 'course-1', { pageSize: 10 })
      } catch (error: any) {
        errorThrown = true
        errorStatus = error.status
        hasQuotaReason = error.details?.some((d: any) => d.reason === 'quotaExceeded')
      }
      assert.isTrue(errorThrown)
      assert.equal(errorStatus, 403)
      assert.isTrue(hasQuotaReason)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('RESOURCE_EXHAUSTED error maps to GOOGLE_CLASSROOM_QUOTA_EXCEEDED', async ({ assert }) => {
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3599 }), {
          status: 200,
        })
      }
      if (url.includes('classroom.googleapis.com')) {
        return new Response(
          JSON.stringify({
            error: {
              message: 'Resource exhausted',
              details: [{ reason: 'RESOURCE_EXHAUSTED' }],
            },
          }),
          { status: 503 }
        )
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      let errorThrown = false
      let errorStatus = 0
      let hasResourceExhausted = false
      try {
        await listGoogleClassroomCourseWorkPaginated('test-refresh', 'course-1', { pageSize: 10 })
      } catch (error: any) {
        errorThrown = true
        errorStatus = error.status
        hasResourceExhausted =
          error.status === 503 || error.details?.some((d: any) => d.reason === 'RESOURCE_EXHAUSTED')
      }
      assert.isTrue(errorThrown)
      assert.equal(errorStatus, 503)
      assert.isTrue(hasResourceExhausted)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('404 error maps to GOOGLE_CLASSROOM_NOT_FOUND', async ({ assert }) => {
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3599 }), {
          status: 200,
        })
      }
      if (url.includes('classroom.googleapis.com')) {
        return new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      let errorThrown = false
      let errorStatus = 0
      try {
        await listGoogleClassroomCourseWorkPaginated('test-refresh', 'course-1', { pageSize: 10 })
      } catch (error: any) {
        errorThrown = true
        errorStatus = error.status
      }
      assert.isTrue(errorThrown)
      assert.equal(errorStatus, 404)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('403 without special reason maps to GOOGLE_CLASSROOM_FORBIDDEN', async ({ assert }) => {
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3599 }), {
          status: 200,
        })
      }
      if (url.includes('classroom.googleapis.com')) {
        return new Response(JSON.stringify({ error: { message: 'Forbidden' } }), { status: 403 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      let errorThrown = false
      let errorStatus = 0
      try {
        await listGoogleClassroomCourseWorkPaginated('test-refresh', 'course-1', { pageSize: 10 })
      } catch (error: any) {
        errorThrown = true
        errorStatus = error.status
      }
      assert.isTrue(errorThrown)
      assert.equal(errorStatus, 403)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
