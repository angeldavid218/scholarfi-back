import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'student_diploma_mints'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['institution_id', 'student_id'])
      table.unique(['institution_id', 'student_id', 'kind'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['institution_id', 'student_id', 'kind'])
      table.unique(['institution_id', 'student_id'])
    })
  }
}
