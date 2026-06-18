import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('budget_allocations', (table) => {
      table.timestamp('released_at').nullable()
      table.index(['institution_id', 'released_at'])
    })

    this.schema.alterTable('reward_transactions', (table) => {
      table
        .integer('budget_allocation_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('budget_allocations')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('reward_transactions', (table) => {
      table.dropForeign(['budget_allocation_id'])
      table.dropColumn('budget_allocation_id')
    })

    this.schema.alterTable('budget_allocations', (table) => {
      table.dropIndex(['institution_id', 'released_at'])
      table.dropColumn('released_at')
    })
  }
}
