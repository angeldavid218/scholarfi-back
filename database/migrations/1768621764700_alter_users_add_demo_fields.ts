import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('institution_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('institutions')
        .onDelete('SET NULL')
      table.boolean('is_active').notNullable().defaultTo(true)

      table.index(['institution_id'])
      table.index(['is_active'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['institution_id'])
      table.dropIndex(['is_active'])
      table.dropColumn('institution_id')
      table.dropColumn('is_active')
    })
  }
}
