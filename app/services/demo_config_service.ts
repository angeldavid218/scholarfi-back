import googleClassroomConfig from '#config/google_classroom'
import { DEMO_LOGIN_ACCOUNTS, DEMO_PASSWORD } from '#fixtures/demo_accounts'

export type PublicDemoConfig =
  | { enabled: false }
  | {
      enabled: true
      classroomMock: true
      password: string
      accounts: typeof DEMO_LOGIN_ACCOUNTS
    }

export function buildPublicDemoConfig(enabled: boolean): PublicDemoConfig {
  if (!enabled) {
    return { enabled: false }
  }

  return {
    enabled: true,
    classroomMock: true,
    password: DEMO_PASSWORD,
    accounts: DEMO_LOGIN_ACCOUNTS,
  }
}

export function getPublicDemoConfig(): PublicDemoConfig {
  return buildPublicDemoConfig(googleClassroomConfig.mockMode)
}
