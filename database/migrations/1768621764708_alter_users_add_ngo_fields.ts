import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('ngo_institution_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('ngo_institutions')
        .onDelete('SET NULL')

      table.index(['ngo_institution_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ngo_institution_id')
    })
  }
}
