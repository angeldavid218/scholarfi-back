import { BaseCommand } from '@adonisjs/core/ace'
import { seedDemoBaseline } from '#services/demo_seed_service'

export default class DemoReset extends BaseCommand {
  static commandName = 'demo:reset'
  static description = 'Reset database and reseed deterministic ScholarFi demo baseline'
  static options = {
    startApp: true,
  }

  async run() {
    const result = await seedDemoBaseline({
      forceReset: true,
    })

    this.logger.success('Demo baseline reset successfully')
    this.logger.info(`Institution: ${result.institutionId}`)
    this.logger.info(`Super admin user: ${result.superAdminId}`)
    this.logger.info(`School admin user: ${result.schoolAdminId}`)
    this.logger.info(`Teacher user: ${result.teacherId}`)
    this.logger.info(`Students: ${result.studentIds.join(', ')}`)
    this.logger.info(
      'Classroom flow: Usar Classroom de demo (or Google OAuth) → import tasks → sync students → sync tasks.'
    )
  }
}
