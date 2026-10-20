import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export type StudentDiplomaMintStatus = 'pending' | 'processing' | 'confirmed' | 'failed'
export const OUTSTANDING_STUDENT_DIPLOMA_KIND = 'outstanding_student'

export default class StudentDiplomaMint extends BaseModel {
  static table = 'student_diploma_mints'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare institutionId: number

  @column()
  declare studentId: number

  @column()
  declare kind: string

  @column()
  declare rank: number

  @column()
  declare points: number

  @column()
  declare displayName: string

  @column()
  declare assetId: string | null

  @column()
  declare merkleTree: string | null

  @column()
  declare leafIndex: number | null

  @column()
  declare signature: string | null

  @column()
  declare metadataUri: string | null

  @column()
  declare status: StudentDiplomaMintStatus

  @column()
  declare errorMessage: string | null

  @column()
  declare attempts: number

  @column.dateTime()
  declare lastAttemptAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
