import { clearGoogleClassroomAccessTokenCache, getGoogleClassroomAccessToken } from '#services/integrations/google_classroom/client'
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
})
