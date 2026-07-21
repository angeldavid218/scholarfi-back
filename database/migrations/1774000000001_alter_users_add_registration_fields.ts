import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.string('registration_number', 64).nullable()
      table.string('account_status', 32).notNullable().defaultTo('active')
      table.index(['registration_number'])
      table.index(['account_status'])
    })

    this.schema.raw(`
      CREATE UNIQUE INDEX users_institution_registration_number_unique
      ON users (institution_id, registration_number)
      WHERE institution_id IS NOT NULL AND registration_number IS NOT NULL
    `)
  }

  async down() {
    this.schema.raw(`DROP INDEX IF EXISTS users_institution_registration_number_unique`)

    this.schema.alterTable('users', (table) => {
      table.dropIndex(['account_status'])
      table.dropIndex(['registration_number'])
      table.dropColumn('account_status')
      table.dropColumn('registration_number')
    })
  }
}
