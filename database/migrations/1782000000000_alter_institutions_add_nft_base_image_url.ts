import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'institutions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('nft_base_image_url', 2048).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('nft_base_image_url')
    })
  }
}
