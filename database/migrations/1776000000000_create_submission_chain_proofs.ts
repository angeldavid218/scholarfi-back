import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'submission_chain_proofs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('submission_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('submissions')
        .onDelete('CASCADE')
        .unique()
      table.string('submission_hash', 64).notNullable()
      table.string('attestation_pda', 64).nullable()
      table.string('attestation_signature', 128).nullable()
      table.string('leaderboard_signature', 128).nullable()
      table.string('school_board_pda', 64).nullable()
      table.string('processed_achievement_pda', 64).nullable()
      table.string('status', 32).notNullable().defaultTo('pending')
      table.text('error_message').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['status'])
      table.index(['submission_hash'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
