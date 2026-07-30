import { StudentAchievementAttestationSchema } from '#database/schema'

export type StudentAchievementAttestationStatus =
  | 'pending'
  | 'attested'
  | 'failed'
  | 'skipped'

export const FIRST_5_ACTIVITIES_KEY = 'first_5_activities'
export const FIRST_5_ACTIVITIES_THRESHOLD = 5
export const FIRST_5_ACTIVITIES_TITLE = 'Logro completado: 5 primeras actividades'

export default class StudentAchievementAttestation extends StudentAchievementAttestationSchema {}
