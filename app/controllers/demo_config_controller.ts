import { getPublicDemoConfig } from '#services/demo_config_service'

export default class DemoConfigController {
  /**
   * GET /public/demo-config — judge sandbox accounts when GOOGLE_CLASSROOM_MOCK=true.
   */
  async show() {
    return { data: getPublicDemoConfig() }
  }
}
