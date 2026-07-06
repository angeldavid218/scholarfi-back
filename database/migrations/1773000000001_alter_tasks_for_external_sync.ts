import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Prepares tasks for Google Classroom sync (next epic).
 * Manual task creation keeps external_source = 'manual'.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('tasks', (table) => {
      table
        .integer('group_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('groups')
        .onDelete('SET NULL')
      table.string('external_source', 30).notNullable().defaultTo('manual')
      table.string('external_id', 255).nullable()
      table.json('sync_metadata').nullable()
      table.index(['institution_id', 'group_id'])
      table.unique(['institution_id', 'external_source', 'external_id'])
    })
  }

  async down() {
    this.schema.alterTable('tasks', (table) => {
      table.dropUnique(['institution_id', 'external_source', 'external_id'])
      table.dropIndex(['institution_id', 'group_id'])
      table.dropColumn('group_id')
      table.dropColumn('external_source')
      table.dropColumn('external_id')
      table.dropColumn('sync_metadata')
    })
  }
}
