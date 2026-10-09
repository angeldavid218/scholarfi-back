import partnerDocsConfig from '#config/partner_docs'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

function authenticatedSession() {
  return {
    [partnerDocsConfig.sessionKey]: true,
  }
}

test.group('Partner docs portal', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('redirects unauthenticated visitors to login', async ({ client, assert }) => {
    const response = await client.get('/partner/docs').redirects(0)
    response.assertStatus(302)
    assert.equal(response.header('location'), '/partner/docs/login')
  })

  test('shows login page', async ({ client, assert }) => {
    const response = await client.get('/partner/docs/login')
    response.assertStatus(200)
    assert.include(response.text(), 'Partner documentation')
    assert.include(response.text(), 'Sign in')
  })

  test('rejects invalid credentials', async ({ client, assert }) => {
    const response = await client.post('/partner/docs/login').redirects(0).form({
      username: 'cloud-campus',
      password: 'wrong-password',
    })

    response.assertStatus(401)
    assert.include(response.text(), 'Invalid username or password')
  })

  test('accepts valid credentials and redirects to docs index', async ({ client, assert }) => {
    const login = await client.post('/partner/docs/login').redirects(0).form({
      username: partnerDocsConfig.username,
      password: partnerDocsConfig.password,
    })
    login.assertStatus(302)
    assert.equal(login.header('location'), '/partner/docs')
  })

  test('renders documentation index for authenticated session', async ({ client, assert }) => {
    const index = await client.get('/partner/docs').withSession(authenticatedSession())
    index.assertStatus(200)
    assert.include(index.text(), 'Cloud Campus')
    assert.include(index.text(), 'Integration model')
  })

  test('renders nested documentation page for authenticated session', async ({
    client,
    assert,
  }) => {
    const page = await client
      .get('/partner/docs/authentication')
      .withSession(authenticatedSession())
    page.assertStatus(200)
    assert.include(page.text(), 'auth/login')
  })

  test('logout clears session', async ({ client, assert }) => {
    const logout = await client
      .post('/partner/docs/logout')
      .withSession(authenticatedSession())
      .redirects(0)
    logout.assertStatus(302)
    assert.equal(logout.header('location'), '/partner/docs/login')

    const index = await client.get('/partner/docs').redirects(0)
    index.assertStatus(302)
    assert.equal(index.header('location'), '/partner/docs/login')
  })
})
