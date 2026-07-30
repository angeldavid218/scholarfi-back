import { BaseCommand } from '@adonisjs/core/ace'
import { seedDemoBaseline } from '#services/demo_seed_service'

export default class DemoSeed extends BaseCommand {
  static commandName = 'demo:seed'
  static description = 'Seed deterministic ScholarFi demo baseline'
  static options = {
    startApp: true,
  }

  async run() {
    const result = await seedDemoBaseline({
      forceReset: false,
    })

    this.logger.success('Demo baseline seeded successfully')
    this.logger.info(`Institution: ${result.institutionId}`)
    this.logger.info(`Super admin user: ${result.superAdminId}`)
    this.logger.info(`School admin user: ${result.schoolAdminId}`)
    this.logger.info(`Teacher user: ${result.teacherId}`)
    this.logger.info(`Students: ${result.studentIds.join(', ')}`)
    this.logger.info(
      'Tasks/rewards come from Classroom mock sync (import all Matematicas 3A + sync all).'
    )
  }
}
