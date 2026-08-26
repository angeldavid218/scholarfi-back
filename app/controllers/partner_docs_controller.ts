import partnerDocsConfig from '#config/partner_docs'
import {
  listPartnerDocPages,
  loadPartnerDocPage,
  renderLoginPage,
  renderPartnerDocsLayout,
} from '#services/partner_docs/partner_docs_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class PartnerDocsController {
  async showLogin({ response, session }: HttpContext) {
    if (session.get(partnerDocsConfig.sessionKey) === true) {
      return response.redirect('/partner/docs')
    }

    return response.header('content-type', 'text/html; charset=utf-8').send(renderLoginPage())
  }

  async storeLogin({ request, response, session }: HttpContext) {
    const username = String(request.input('username', '')).trim()
    const password = String(request.input('password', ''))

    if (
      username === partnerDocsConfig.username &&
      password === partnerDocsConfig.password &&
      username.length > 0 &&
      password.length > 0
    ) {
      session.put(partnerDocsConfig.sessionKey, true)
      const intended = session.pull('partner_docs_intended') as string | undefined
      return response.redirect(intended ?? '/partner/docs')
    }

    return response
      .status(401)
      .header('content-type', 'text/html; charset=utf-8')
      .send(renderLoginPage('Invalid username or password'))
  }

  async destroyLogin({ response, session }: HttpContext) {
    session.forget(partnerDocsConfig.sessionKey)
    session.forget('partner_docs_intended')
    return response.redirect('/partner/docs/login')
  }

  async index({ response }: HttpContext) {
    const pages = await listPartnerDocPages()
    const page = await loadPartnerDocPage('index')

    if (!page) {
      return response.notFound('Documentation index not found')
    }

    const html = renderPartnerDocsLayout({
      title: page.title,
      bodyHtml: page.html,
      pages,
      activeSlug: 'index',
      showLogout: true,
    })

    return response.header('content-type', 'text/html; charset=utf-8').send(html)
  }

  async show({ params, response }: HttpContext) {
    const slug = String(params.slug ?? '')
    const page = await loadPartnerDocPage(slug)

    if (!page) {
      return response.notFound('Documentation page not found')
    }

    const pages = await listPartnerDocPages()
    const html = renderPartnerDocsLayout({
      title: page.title,
      bodyHtml: page.html,
      pages,
      activeSlug: slug,
      showLogout: true,
    })

    return response.header('content-type', 'text/html; charset=utf-8').send(html)
  }
}
