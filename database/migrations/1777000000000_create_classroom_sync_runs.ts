import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'classroom_sync_runs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('queue_job_id', 64).nullable()
      table
        .integer('task_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tasks')
        .onDelete('CASCADE')
      table
        .integer('teacher_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('institutions')
        .onDelete('CASCADE')
      table.string('status', 20).notNullable().defaultTo('queued')
      table.json('result_json').nullable()
      table.text('error_message').nullable()
      table.string('request_id', 64).nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['status', 'id'])
      table.index(['teacher_id', 'task_id', 'status'])
      table.index(['institution_id', 'id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
