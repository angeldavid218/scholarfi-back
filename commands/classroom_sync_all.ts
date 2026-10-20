import { BaseCommand, flags } from '@adonisjs/core/ace'
import { tryAcquireGlobalLock } from '#services/cron/global_lock_service'
import { enqueueAllClassroomSyncsForConnectedTeachers } from '#services/integrations/google_classroom/sync_all_service'

export default class ClassroomSyncAll extends BaseCommand {
  static commandName = 'classroom:sync-all'
  static description = 'Sync all connected Google Classroom teachers (cron-friendly, with lock)'
  static options = {
    startApp: true,
  }

  @flags.string({
    flagName: 'request-id',
    description: 'Optional request ID for tracing',
  })
  declare requestId: string | undefined

  async run() {
    const lock = await tryAcquireGlobalLock('classroom:sync-all')

    if (!lock.acquired) {
      this.logger.info('Another classroom:sync-all is already running. Exiting cleanly.')
      return
    }

    try {
      this.logger.info('Starting classroom:sync-all sweep')

      const result = await enqueueAllClassroomSyncsForConnectedTeachers({
        requestId: this.requestId,
      })

      this.logger.info(
        `Classroom sync-all completed: teachers=${result.teachers} failures=${result.teacherFailures} tasks=${result.tasks} runs=${result.runs.length}`
      )
    } finally {
      await lock.release()
    }
  }
}
