import { BaseCommand, flags } from '@adonisjs/core/ace'
import { tryAcquireGlobalLock } from '#services/cron/global_lock_service'
import { enqueueProgressDiplomas } from '#services/cnft/cnft_progress_enqueue_service'

export default class CnftEnqueueProgress extends BaseCommand {
  static commandName = 'cnft:enqueue-progress'
  static description =
    'Enqueue pending Progreso Académico diploma rows for improving students (cron-friendly)'
  static options = {
    startApp: true,
  }

  @flags.number({
    flagName: 'institution-id',
    description: 'Limit to one institution',
  })
  declare institutionId: number | undefined

  @flags.number({
    flagName: 'limit',
    description: 'Max improving students to consider in this run',
    default: 50,
  })
  declare limit: number

  async run() {
    const lock = await tryAcquireGlobalLock('cnft:enqueue-progress')

    if (!lock.acquired) {
      this.logger.info('Another cnft:enqueue-progress is already running. Exiting cleanly.')
      return
    }

    try {
      this.logger.info(
        `Starting cnft:enqueue-progress: limit=${this.limit} institutionId=${this.institutionId ?? 'all'}`
      )

      const result = await enqueueProgressDiplomas({
        institutionId: this.institutionId,
        limit: this.limit,
      })

      this.logger.info(
        `Enqueue completed: considered=${result.considered} enqueued=${result.enqueued} skippedExisting=${result.skippedExisting} skippedNotOnChain=${result.skippedNotOnChain} skippedNoWallet=${result.skippedNoWallet} skippedTree=${result.skippedTree}`
      )
    } finally {
      await lock.release()
    }
  }
}
