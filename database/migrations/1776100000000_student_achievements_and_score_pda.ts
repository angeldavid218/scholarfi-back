import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('submission_chain_proofs', (table) => {
      table.string('student_score_pda', 64).nullable()
    })

    this.schema.createTable('student_achievement_attestations', (table) => {
      table.increments('id').notNullable()
      table
        .integer('student_id')
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
      table.string('achievement_key', 64).notNullable()
      table.integer('threshold').unsigned().notNullable()
      table.string('achievement_hash', 64).notNullable()
      table.string('attestation_pda', 64).nullable()
      table.string('attestation_signature', 128).nullable()
      table.string('status', 32).notNullable().defaultTo('pending')
      table.text('error_message').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['student_id', 'achievement_key'])
      table.index(['institution_id', 'achievement_key'])
      table.index(['status'])
    })
  }

  async down() {
    this.schema.dropTable('student_achievement_attestations')
    this.schema.alterTable('submission_chain_proofs', (table) => {
      table.dropColumn('student_score_pda')
    })
  }
}
