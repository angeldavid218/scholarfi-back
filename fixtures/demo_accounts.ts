/**
 * Demo login accounts shown when GOOGLE_CLASSROOM_MOCK=true.
 * Passwords match demo:seed / demo:reset (`DemoPass123!`).
 */

export const DEMO_PASSWORD = 'DemoPass123!'

export type DemoLoginAccount = {
  role: 'super_admin' | 'school_admin' | 'teacher' | 'student'
  email: string
  label: string
}

export const DEMO_LOGIN_ACCOUNTS: DemoLoginAccount[] = [
  { role: 'super_admin', email: 'demo.super@scholarfi.test', label: 'Super admin' },
  { role: 'school_admin', email: 'demo.admin@scholarfi.test', label: 'Admin escolar' },
  { role: 'teacher', email: 'demo.teacher@scholarfi.test', label: 'Docente' },
  { role: 'student', email: 'sofia.hernandez@scholarfi.test', label: 'Estudiante' },
]
