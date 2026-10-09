import { TaskSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'

export default class Task extends TaskSchema {
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
  declare syncMetadata: any | null
}
