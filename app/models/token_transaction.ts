import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class TokenTransaction extends BaseModel {
  static table = 'token_transactions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare institutionId: number

  @column()
  declare userId: number

  @column()
  declare achievementId: number | null

  @column()
  declare redemptionId: number | null

  @column()
  declare amount: number

  @column()
  declare type: string

  @column()
  declare status: string

  @column()
  declare provider: string

  @column()
  declare transactionSignature: string | null

  @column()
  declare tokenMint: string | null

  @column()
  declare walletPublicKey: string | null

  @column()
  declare errorMessage: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
