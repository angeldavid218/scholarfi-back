import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class CatalogReward extends BaseModel {
  static table = 'catalog_rewards'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare institutionId: number

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare creditCost: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
