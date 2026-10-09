import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('group_import_runs', (table) => {
      table.string('status', 32).notNullable().alter()
    })
  }

  async down() {
    this.schema.alterTable('group_import_runs', (table) => {
      table.string('status', 20).notNullable().alter()
    })
  }
}
