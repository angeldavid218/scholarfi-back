import { StudentAchievementAttestationSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export type StudentAchievementAttestationStatus =
  'pending' | 'processing' | 'attested' | 'failed' | 'skipped'

export const FIRST_5_ACTIVITIES_KEY = 'first_5_activities'
export const FIRST_5_ACTIVITIES_THRESHOLD = 2
export const FIRST_5_ACTIVITIES_TITLE = 'Logro completado: 2 primeras actividades'

export default class StudentAchievementAttestation extends StudentAchievementAttestationSchema {
  @column()
  declare attempts: number

  @column.dateTime()
  declare lastAttemptAt: DateTime | null
}
