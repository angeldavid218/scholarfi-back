import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'teacher_integrations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
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
      table.string('provider', 40).notNullable().defaultTo('google_classroom')
      table.string('external_user_id', 255).notNullable()
      table.string('external_email', 255).notNullable()
      table.text('encrypted_refresh_token').notNullable()
      table.text('scopes').notNullable()
      table.timestamp('connected_at').notNullable().defaultTo(this.now())
      table.timestamp('last_sync_at').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').nullable()

      table.unique(['teacher_id', 'provider'])
      table.index(['institution_id', 'provider'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
