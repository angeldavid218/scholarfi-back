import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'funding_programs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('ngo_institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('ngo_institutions')
        .onDelete('CASCADE')
      table.string('name', 180).notNullable()
      table.text('description').notNullable()
      table.integer('total_budget').notNullable()
      table.string('allocation_type', 20).notNullable().defaultTo('equal')
      table.date('start_date').notNullable()
      table.date('end_date').notNullable()
      table.string('status', 20).notNullable().defaultTo('draft')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['ngo_institution_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
