import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export type GradeProgressCategory =
  | 'improving'
  | 'maintaining'
  | 'insufficient_data'
  | 'none'

export default class StudentGradeProgress extends BaseModel {
  static table = 'student_grade_progress'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare institutionId: number

  @column()
  declare studentId: number

  @column()
  declare category: GradeProgressCategory

  @column()
  declare gradedCount: number

  @column()
  declare earlyAvg: string | null

  @column()
  declare lateAvg: string | null

  @column()
  declare delta: string | null

  @column.dateTime()
  declare analyzedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
