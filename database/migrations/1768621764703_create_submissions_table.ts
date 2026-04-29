import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'submissions'

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
        .integer('task_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tasks')
        .onDelete('CASCADE')
      table
        .integer('student_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.text('evidence_text').notNullable()
      table.string('evidence_url', 500).nullable()
      table.string('status', 30).notNullable().defaultTo('pending')
      table.timestamp('submitted_at').notNullable().defaultTo(this.now())

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['task_id', 'student_id'])
      table.index(['institution_id', 'status'])
      table.index(['student_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
