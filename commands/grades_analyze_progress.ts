import { BaseCommand, flags } from '@adonisjs/core/ace'
import { tryAcquireGlobalLock } from '#services/cron/global_lock_service'
import {
  listInstitutionIdsWithGradedSubmissions,
  upsertInstitutionGradeProgress,
} from '#services/analytics/grade_progress_service'

export default class GradesAnalyzeProgress extends BaseCommand {
  static commandName = 'grades:analyze-progress'
  static description =
    'Analyze Classroom external grades and upsert improving/maintaining progress rows (cron-friendly)'
  static options = {
    startApp: true,
  }

  @flags.number({
    flagName: 'institution-id',
    description: 'Limit analysis to one institution',
  })
  declare institutionId: number | undefined

  async run() {
    const lock = await tryAcquireGlobalLock('grades:analyze-progress')

    if (!lock.acquired) {
      this.logger.info('Another grades:analyze-progress is already running. Exiting cleanly.')
      return
    }

    try {
      await this.executeAnalyze()
    } finally {
      await lock.release()
    }
  }

  private async executeAnalyze() {
    const institutionIds = this.institutionId
      ? [this.institutionId]
      : await listInstitutionIdsWithGradedSubmissions()

    this.logger.info(
      `Starting grades:analyze-progress: institutions=${institutionIds.length}`
    )

    let totalStudents = 0
    let totalImproving = 0

    for (const institutionId of institutionIds) {
      const result = await upsertInstitutionGradeProgress(institutionId)
      totalStudents += result.students
      totalImproving += result.improving
      this.logger.info(
        `Institution ${institutionId}: students=${result.students} improving=${result.improving} maintaining=${result.maintaining} insufficient=${result.insufficientData} none=${result.none}`
      )
    }

    this.logger.info(
      `Analyze completed: institutions=${institutionIds.length} students=${totalStudents} improving=${totalImproving}`
    )
  }
}
