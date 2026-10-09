import { ClassroomSyncRunSchema } from '#database/schema'
import type { GoogleClassroomSyncResult } from '#services/integrations/google_classroom/types'
import { column } from '@adonisjs/lucid/orm'

export type ClassroomSyncRunStatus = 'queued' | 'running' | 'completed' | 'failed'

export default class ClassroomSyncRun extends ClassroomSyncRunSchema {
  @column({
    prepare: (value: unknown) => {
      if (value === null || value === undefined) return null
      return typeof value === 'string' ? value : JSON.stringify(value)
    },
    consume: (value: unknown) => {
      if (value === null || value === undefined) return null
      if (typeof value === 'object') return value
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return null
        }
      }
      return null
    },
  })
  declare resultJson: GoogleClassroomSyncResult | null

  get isTerminal(): boolean {
    return this.status === 'completed' || this.status === 'failed'
  }
}
