import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'institutions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('crypto_wallets_enabled').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('crypto_wallets_enabled')
    })
  }
}
