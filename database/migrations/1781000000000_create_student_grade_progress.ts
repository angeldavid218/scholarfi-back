import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'student_grade_progress'

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
        .integer('student_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('category', 32).notNullable()
      table.integer('graded_count').unsigned().notNullable().defaultTo(0)
      table.decimal('early_avg', 10, 4).nullable()
      table.decimal('late_avg', 10, 4).nullable()
      table.decimal('delta', 10, 4).nullable()
      table.timestamp('analyzed_at').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['institution_id', 'student_id'])
      table.index(['institution_id', 'category'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
