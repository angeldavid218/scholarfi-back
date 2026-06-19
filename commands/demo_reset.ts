import { BaseCommand, flags } from '@adonisjs/core/ace'
import { seedDemoBaseline } from '#services/demo_seed_service'

export default class DemoReset extends BaseCommand {
  static commandName = 'demo:reset'
  static description = 'Reset database and reseed deterministic ScholarFi demo baseline'
  static options = {
    startApp: true,
  }

  @flags.boolean({
    flagName: 'starter',
    description: 'Omit tasks/submissions/rewards (institution + users only)',
  })
  declare starter: boolean

  async run() {
    const result = await seedDemoBaseline({
      forceReset: true,
      includeStarterData: !this.starter,
    })

    this.logger.success('Demo baseline reset successfully')
    this.logger.info(`Institution: ${result.institutionId}`)
    this.logger.info(`NGO: ${result.ngoId} (${result.schoolFundingBudget} credits released to school)`)
    this.logger.info(`Funding program: ${result.fundingProgramId}`)
    this.logger.info(`NGO admin user: ${result.ngoAdminId} (demo.ngo@scholarfi.test / DemoPass123!)`)
    this.logger.info(`Super admin user: ${result.superAdminId}`)
    this.logger.info(`School admin user: ${result.schoolAdminId}`)
    this.logger.info(`Teacher user: ${result.teacherId}`)
    this.logger.info(`Students: ${result.studentIds.join(', ')}`)
    if (result.starterTaskId && result.starterSubmissionId) {
      this.logger.info(`Starter task: ${result.starterTaskId}`)
      this.logger.info(`Starter submission: ${result.starterSubmissionId}`)
    }
  }
}
