import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'student_diploma_mints'

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
      table.string('kind', 64).notNullable().defaultTo('outstanding_student')
      table.integer('rank').unsigned().notNullable()
      table.integer('points').notNullable()
      table.string('display_name', 255).notNullable()
      table.string('asset_id', 64).nullable()
      table.string('merkle_tree', 64).nullable()
      table.integer('leaf_index').unsigned().nullable()
      table.string('signature', 128).nullable()
      table.text('metadata_uri').nullable()
      table.string('status', 32).notNullable().defaultTo('pending')
      table.text('error_message').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['institution_id', 'student_id'])
      table.index(['institution_id', 'status'])
      table.index(['student_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
