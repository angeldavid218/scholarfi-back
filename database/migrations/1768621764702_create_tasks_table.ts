import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tasks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('institutions')
        .onDelete('CASCADE')
      table
        .integer('created_by_teacher_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.string('title', 180).notNullable()
      table.text('description').notNullable()
      table.integer('reward_amount').notNullable()
      table.timestamp('due_at').nullable()
      table.string('status', 20).notNullable().defaultTo('active')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['institution_id', 'status'])
      table.index(['created_by_teacher_id'])
      table.index(['due_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
