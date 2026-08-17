import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('submissions', (table) => {
      table.decimal('external_grade', 10, 2).nullable()
      table.timestamp('grade_checked_at').nullable()
      table.string('reward_skipped_reason', 120).nullable()
    })
  }

  async down() {
    this.schema.alterTable('submissions', (table) => {
      table.dropColumn('external_grade')
      table.dropColumn('grade_checked_at')
      table.dropColumn('reward_skipped_reason')
    })
  }
}
