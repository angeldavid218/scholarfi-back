import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from '#models/user'

export default class TokenBalance extends BaseModel {
  static table = 'token_balances'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare balance: number

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
