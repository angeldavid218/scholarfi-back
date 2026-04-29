import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'submission_validations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('submission_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('submissions')
        .onDelete('CASCADE')
      table
        .integer('teacher_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .integer('school_admin_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('action', 20).notNullable()
      table.text('comment').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())

      table.index(['submission_id', 'created_at'])
      table.index(['action'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
