import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('student_achievement_attestations', (table) => {
      table.integer('attempts').unsigned().notNullable().defaultTo(0)
      table.timestamp('last_attempt_at').nullable()
    })

    this.schema.alterTable('student_diploma_mints', (table) => {
      table.integer('attempts').unsigned().notNullable().defaultTo(0)
      table.timestamp('last_attempt_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable('student_achievement_attestations', (table) => {
      table.dropColumn('attempts')
      table.dropColumn('last_attempt_at')
    })

    this.schema.alterTable('student_diploma_mints', (table) => {
      table.dropColumn('attempts')
      table.dropColumn('last_attempt_at')
    })
  }
}
