import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('subjects', (table) => {
      table.increments('id').notNullable()
      table
        .integer('institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('institutions')
        .onDelete('CASCADE')
      table.string('name', 120).notNullable()
      table.string('code', 50).nullable()
      table.string('status', 20).notNullable().defaultTo('active')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['institution_id', 'status'])
      table.index(['institution_id', 'name'])
    })

    this.schema.createTable('groups', (table) => {
      table.increments('id').notNullable()
      table
        .integer('institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('institutions')
        .onDelete('CASCADE')
      table
        .integer('subject_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('subjects')
        .onDelete('RESTRICT')
      table.string('name', 180).notNullable()
      table.string('section', 60).nullable()
      table.string('code', 50).nullable()
      table.json('sync_metadata').nullable()
      table.string('status', 20).notNullable().defaultTo('active')
      table.string('external_source', 30).notNullable().defaultTo('manual')
      table.string('external_id', 255).nullable()
      table
        .integer('created_by_teacher_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['institution_id', 'external_source', 'external_id'])
      table.index(['institution_id', 'subject_id', 'section'])
      table.index(['institution_id', 'status'])
    })

    this.schema.createTable('group_teachers', (table) => {
      table.increments('id').notNullable()
      table
        .integer('institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('institutions')
        .onDelete('CASCADE')
      table
        .integer('group_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('groups')
        .onDelete('CASCADE')
      table
        .integer('teacher_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['group_id', 'teacher_id'])
      table.index(['institution_id', 'teacher_id'])
    })

    this.schema.createTable('group_students', (table) => {
      table.increments('id').notNullable()
      table
        .integer('institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('institutions')
        .onDelete('CASCADE')
      table
        .integer('group_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('groups')
        .onDelete('CASCADE')
      table
        .integer('student_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['group_id', 'student_id'])
      table.index(['institution_id', 'student_id'])
    })

    this.schema.createTable('group_import_runs', (table) => {
      table.increments('id').notNullable()
      table
        .integer('institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('institutions')
        .onDelete('CASCADE')
      table
        .integer('uploaded_by_teacher_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('filename', 255).notNullable()
      table.string('status', 20).notNullable()
      table.json('summary_json').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['institution_id', 'uploaded_by_teacher_id'])
      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable('group_import_runs')
    this.schema.dropTable('group_students')
    this.schema.dropTable('group_teachers')
    this.schema.dropTable('groups')
    this.schema.dropTable('subjects')
  }
}
