import { loadPartnerDocPage, listPartnerDocPages } from '#services/partner_docs/partner_docs_service'
import { test } from '@japa/runner'

test.group('Partner docs service', () => {
  test('loads cloud campus documentation pages from disk', async ({ assert }) => {
    const pages = await listPartnerDocPages()
    assert.isAbove(pages.length, 5)

    const index = await loadPartnerDocPage('index')
    assert.isNotNull(index)
    assert.include(index!.html, 'Integration model')
    assert.include(index!.html, 'Cloud Campus')

    const authentication = await loadPartnerDocPage('authentication')
    assert.isNotNull(authentication)
    assert.include(authentication!.html, 'auth/login')
  })
})
