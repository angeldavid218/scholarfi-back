import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(
      `
      UPDATE student_achievement_attestations
      SET attempts = 999, status = 'needs_review'
      WHERE status = 'failed' AND (attempts IS NULL OR attempts = 0)
      `
    )

    await this.db.rawQuery(
      `
      UPDATE student_diploma_mints
      SET attempts = 999, status = 'needs_review'
      WHERE status = 'failed' AND (attempts IS NULL OR attempts = 0)
      `
    )
  }

  async down() {
    // No-op: backfill is one-way
  }
}
