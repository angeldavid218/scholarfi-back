import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'budget_allocations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('funding_program_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('funding_programs')
        .onDelete('CASCADE')
      table
        .integer('institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('institutions')
        .onDelete('RESTRICT')
      table.integer('allocated_budget').notNullable()
      table.integer('utilized_budget').notNullable().defaultTo(0)
      table.string('status', 20).notNullable().defaultTo('active')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['funding_program_id', 'institution_id'])
      table.index(['funding_program_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
