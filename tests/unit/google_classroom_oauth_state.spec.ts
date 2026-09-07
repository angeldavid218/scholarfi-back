import { signOAuthState, verifyOAuthState } from '#services/integrations/google_classroom/oauth_state'
import { test } from '@japa/runner'

test.group('Google Classroom OAuth state', () => {
  test('signs and verifies a fresh payload', ({ assert }) => {
    const payload = { teacherId: 12, institutionId: 34, ts: Date.now() }
    const state = signOAuthState(payload)
    const verified = verifyOAuthState(state)
    assert.equal(verified.teacherId, 12)
    assert.equal(verified.institutionId, 34)
    assert.equal(verified.ts, payload.ts)
  })

  test('rejects a malformed state string', ({ assert }) => {
    assert.throws(() => verifyOAuthState('not-a-valid-state'), 'Invalid OAuth state format')
  })

  test('rejects a tampered signature', ({ assert }) => {
    const state = signOAuthState({ teacherId: 1, institutionId: 2, ts: Date.now() })
    const [data, sig] = state.split('.')
    assert.exists(data)
    assert.exists(sig)
    const flipped = sig.endsWith('a') ? `${sig.slice(0, -1)}b` : `${sig.slice(0, -1)}a`
    assert.throws(() => verifyOAuthState(`${data}.${flipped}`), 'Invalid OAuth state signature')
  })

  test('rejects an expired payload', ({ assert }) => {
    const state = signOAuthState({
      teacherId: 1,
      institutionId: 2,
      ts: Date.now() - 16 * 60 * 1000,
    })
    assert.throws(() => verifyOAuthState(state), 'OAuth state expired')
  })
})
