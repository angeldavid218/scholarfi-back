import { BaseCommand, flags } from '@adonisjs/core/ace'
import {
  createSasConnection,
  explorerAddressUrl,
  explorerTxUrl,
  getSasMilestoneSchemaName,
  isSasEnabled,
} from '#services/attestation/sas_attestation_client'
import {
  FIRST_5_ACTIVITIES_TITLE,
  attestFirst5MilestonesBatch,
  ensureMilestoneSchemaReady,
} from '#services/attestation/milestone_attestation_service'

export default class SasAttestMilestones extends BaseCommand {
  static commandName = 'sas:attest-milestones'
  static description =
    'Issue off-sync milestone SAS attestations (MVP: Logro completado 2 primeras actividades)'
  static options = {
    startApp: true,
  }

  @flags.number({
    flagName: 'institution-id',
    description: 'Limit to one institution',
  })
  declare institutionId: number | undefined

  @flags.number({
    flagName: 'student',
    description: 'Limit to one student user id',
  })
  declare student: number | undefined

  @flags.number({
    flagName: 'limit',
    description: 'Max candidates to process in batch mode',
    default: 100,
  })
  declare limit: number

  @flags.boolean({
    flagName: 'ensure-schema',
    description: 'Create scholarfi.milestone.v1 schema if missing',
    default: true,
  })
  declare ensureSchema: boolean

  async run() {
    if (!isSasEnabled()) {
      this.logger.warning('SAS_ENABLED is not true — milestone attestations will be skipped')
    }

    const connection = createSasConnection()
    this.logger.info(`RPC: ${connection.rpcEndpoint}`)
    this.logger.info(`Milestone: ${FIRST_5_ACTIVITIES_TITLE}`)

    if (this.ensureSchema) {
      const schema = await ensureMilestoneSchemaReady()
      if (schema.created) {
        this.logger.success(
          `Milestone schema created (${getSasMilestoneSchemaName()}): ${schema.signature}`
        )
      } else {
        this.logger.info(`Milestone schema ready: ${schema.schemaPda}`)
      }
      this.logger.info(`Pin if needed: SAS_MILESTONE_SCHEMA_PDA=${schema.schemaPda}`)
      this.logger.info(`Using milestone schema: ${schema.schemaPda}`)
    }

    const results = await attestFirst5MilestonesBatch({
      institutionId: this.institutionId,
      studentId: this.student,
      limit: this.limit,
    })

    if (results.length === 0) {
      this.logger.info('No eligible students found')
      return
    }

    for (const result of results) {
      const prefix = `student=${result.studentId} institution=${result.institutionId} count=${result.rewardedCount}`
      if (result.status === 'attested') {
        this.logger.success(`${prefix} → attested ${result.attestationPda}`)
        if (result.attestationPda) {
          this.logger.info(`  ${explorerAddressUrl(result.attestationPda)}`)
        }
        if (result.attestationSignature && result.attestationSignature !== 'existing') {
          this.logger.info(`  tx: ${explorerTxUrl(result.attestationSignature)}`)
        }
      } else if (result.status === 'already_attested') {
        this.logger.info(`${prefix} → already attested ${result.attestationPda}`)
      } else if (result.status === 'skipped') {
        this.logger.info(`${prefix} → skipped (${result.errorMessage})`)
      } else {
        this.logger.error(`${prefix} → failed (${result.errorMessage})`)
      }
    }

    const attested = results.filter((r) => r.status === 'attested').length
    const already = results.filter((r) => r.status === 'already_attested').length
    const skipped = results.filter((r) => r.status === 'skipped').length
    const failed = results.filter((r) => r.status === 'failed').length
    this.logger.info(
      `Done: attested=${attested} already=${already} skipped=${skipped} failed=${failed}`
    )
  }
}
