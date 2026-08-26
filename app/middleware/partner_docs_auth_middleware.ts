import partnerDocsConfig from '#config/partner_docs'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class PartnerDocsAuthMiddleware {
  async handle({ request, response, session }: HttpContext, next: NextFn) {
    if (session.get(partnerDocsConfig.sessionKey) === true) {
      return next()
    }

    session.put('partner_docs_intended', request.url())
    return response.redirect('/partner/docs/login')
  }
}
