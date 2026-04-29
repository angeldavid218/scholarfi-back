import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reward_transactions'

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
        .integer('submission_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('submissions')
        .onDelete('RESTRICT')
      table
        .integer('student_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.integer('amount').notNullable()
      table.string('type', 20).notNullable().defaultTo('credit')
      table.string('status', 20).notNullable().defaultTo('posted')
      table.timestamp('posted_at').notNullable().defaultTo(this.now())

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['submission_id'])
      table.index(['institution_id', 'student_id'])
      table.index(['posted_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
