import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.string('wallet_public_key', 88).nullable()
      table.text('encrypted_wallet_secret').nullable()
    })

    this.schema.createTable('catalog_rewards', (table) => {
      table.increments('id').notNullable()
      table
        .integer('institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('institutions')
        .onDelete('CASCADE')
      table.string('title', 255).notNullable()
      table.text('description').nullable()
      table.integer('credit_cost').unsigned().notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['institution_id'])
    })

    this.schema.createTable('token_balances', (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.integer('balance').notNullable().defaultTo(0)
      table.timestamp('updated_at').notNullable()
      table.unique(['user_id'])
    })

    this.schema.createTable('redemptions', (table) => {
      table.increments('id').notNullable()
      table
        .integer('institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('institutions')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('reward_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('catalog_rewards')
        .onDelete('RESTRICT')
      table.integer('amount').unsigned().notNullable()
      table.string('status', 32).notNullable().defaultTo('pending')
      table.string('transaction_signature', 128).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['institution_id', 'status'])
      table.index(['user_id'])
    })

    this.schema.createTable('token_transactions', (table) => {
      table.increments('id').notNullable()
      table
        .integer('institution_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('institutions')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('achievement_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('submissions')
        .onDelete('SET NULL')
      table
        .integer('redemption_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('redemptions')
        .onDelete('SET NULL')
      table.integer('amount').notNullable()
      table.string('type', 20).notNullable()
      table.string('status', 20).notNullable()
      table.string('provider', 20).notNullable()
      table.string('transaction_signature', 128).nullable()
      table.string('token_mint', 88).nullable()
      table.string('wallet_public_key', 88).nullable()
      table.text('error_message').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['institution_id', 'user_id'])
      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable('token_transactions')
    this.schema.dropTable('redemptions')
    this.schema.dropTable('token_balances')
    this.schema.dropTable('catalog_rewards')
    this.schema.alterTable('users', (table) => {
      table.dropColumn('wallet_public_key')
      table.dropColumn('encrypted_wallet_secret')
    })
  }
}
