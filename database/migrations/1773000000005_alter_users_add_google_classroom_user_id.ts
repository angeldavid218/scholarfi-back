import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.string('google_classroom_user_id', 64).nullable()
      table.unique(['google_classroom_user_id'])
    })
  }

  async down() {
    this.schema.alterTable('users', (table) => {
      table.dropUnique(['google_classroom_user_id'])
      table.dropColumn('google_classroom_user_id')
    })
  }
}
