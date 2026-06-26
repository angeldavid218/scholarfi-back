import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class Redemption extends BaseModel {
  static table = 'redemptions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare institutionId: number

  @column()
  declare userId: number

  @column()
  declare rewardId: number

  @column()
  declare amount: number

  @column()
  declare status: string

  @column()
  declare transactionSignature: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
