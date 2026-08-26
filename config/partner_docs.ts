import env from '#start/env'
import app from '@adonisjs/core/services/app'

const partnerDocsConfig = {
  get username(): string {
    return env.get('PARTNER_DOCS_USERNAME') ?? ''
  },
  get password(): string {
    return env.get('PARTNER_DOCS_PASSWORD') ?? ''
  },
  sessionKey: 'partner_docs_authenticated',
  contentRoot: app.makePath('docs/partners/cloud-campus'),
}

export default partnerDocsConfig
