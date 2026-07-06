import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('institution_credit_pools', (table) => {
      table.increments('id').notNullable()
      table
        .integer('institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('institutions')
        .onDelete('CASCADE')
      table.integer('allocated_credits').notNullable().defaultTo(0)
      table.integer('utilized_credits').notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['institution_id'])
    })

    this.schema.createTable('institution_credit_entries', (table) => {
      table.increments('id').notNullable()
      table
        .integer('institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('institutions')
        .onDelete('CASCADE')
      table.string('entry_type', 32).notNullable()
      table.integer('amount').notNullable()
      table
        .integer('submission_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('submissions')
        .onDelete('SET NULL')
      table
        .integer('token_transaction_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('token_transactions')
        .onDelete('SET NULL')
      table
        .integer('actor_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.text('notes').nullable()
      table.timestamp('created_at').notNullable()
      table.index(['institution_id', 'entry_type'])
      table.index(['submission_id'])
    })
  }

  async down() {
    this.schema.dropTable('institution_credit_entries')
    this.schema.dropTable('institution_credit_pools')
  }
}
