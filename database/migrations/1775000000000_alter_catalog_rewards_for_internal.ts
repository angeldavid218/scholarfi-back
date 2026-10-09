import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('catalog_rewards', (table) => {
      table.boolean('is_active').notNullable().defaultTo(true)
      table.string('source', 32).notNullable().defaultTo('internal')
      table.index(
        ['institution_id', 'is_active', 'source'],
        'catalog_rewards_institution_active_source_idx'
      )
    })
  }

  async down() {
    this.schema.alterTable('catalog_rewards', (table) => {
      table.dropIndex(
        ['institution_id', 'is_active', 'source'],
        'catalog_rewards_institution_active_source_idx'
      )
      table.dropColumn('source')
      table.dropColumn('is_active')
    })
  }
}
