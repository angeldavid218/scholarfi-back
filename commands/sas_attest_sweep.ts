import { BaseCommand, flags } from '@adonisjs/core/ace'
import { tryAcquireGlobalLock } from '#services/cron/global_lock_service'
import {
  claimAttestationForProcessing,
  findEligibleAttestations,
  findStaleProcessingAttestations,
  markAttestationFailed,
  markAttestationSucceeded,
  recoverStaleAttestation,
} from '#services/attestation/milestone_attestation_claim_service'
import {
  FIRST_5_ACTIVITIES_KEY,
  ensureMilestoneSchemaReady,
} from '#services/attestation/milestone_attestation_service'
import {
  createSasConnection,
  isSasEnabled,
  loadSasAuthorizedSignerKeypair,
  resolveCredentialPda,
  resolveMilestoneSchemaPda,
  createMilestoneAttestation,
  buildMilestoneData,
  explorerTxUrl,
} from '#services/attestation/sas_attestation_client'
import { achievementHash, studentIdHash } from '#services/attestation/hashes'
import { isInstitutionOnChainExecution } from '#services/tokens/factory'
import { getActiveSeasonId } from '#services/leaderboard/leaderboard_score_service'
import User from '#models/user'
import env from '#start/env'

export default class SasAttestSweep extends BaseCommand {
  static commandName = 'sas:attest-sweep'
  static description =
    'Sweep eligible milestone attestations with locking and retry limits (cron-friendly)'
  static options = {
    startApp: true,
  }

  @flags.number({
    flagName: 'limit',
    description: 'Max attestations to process in this run',
    default: 20,
  })
  declare limit: number

  @flags.number({
    flagName: 'max-attempts',
    description: 'Max attempts before giving up on a failed attestation',
    default: 3,
  })
  declare maxAttempts: number

  @flags.number({
    flagName: 'delay-ms',
    description: 'Delay in milliseconds between attestations',
  })
  declare delayMs: number | undefined

  @flags.number({
    flagName: 'institution-id',
    description: 'Limit to one institution',
  })
  declare institutionId: number | undefined

  @flags.boolean({
    flagName: 'recover-stale',
    description: 'Recover stale processing records before sweep',
    default: true,
  })
  declare recoverStale: boolean

  async run() {
    const lock = await tryAcquireGlobalLock('sas:attest-sweep')

    if (!lock.acquired) {
      this.logger.info('Another sas:attest-sweep is already running. Exiting cleanly.')
      return
    }

    try {
      await this.executeSweep()
    } finally {
      await lock.release()
    }
  }

  private async executeSweep() {
    if (!isSasEnabled()) {
      this.logger.warning('SAS_ENABLED is not true — attestations will be skipped')
      return
    }

    const delayMs =
      this.delayMs ??
      (env.get('SAS_ATTEST_DELAY_MS') ? Number(env.get('SAS_ATTEST_DELAY_MS')) : 1500)

    this.logger.info(
      `Starting sas:attest-sweep: limit=${this.limit} maxAttempts=${this.maxAttempts} delayMs=${delayMs} institutionId=${this.institutionId ?? 'all'}`
    )

    await ensureMilestoneSchemaReady()

    if (this.recoverStale) {
      await this.recoverStaleRecords()
    }

    const eligible = await findEligibleAttestations({
      institutionId: this.institutionId,
      achievementKey: FIRST_5_ACTIVITIES_KEY,
      maxAttempts: this.maxAttempts,
      limit: this.limit,
    })

    this.logger.info(`Found ${eligible.length} eligible attestations`)

    let attested = 0
    let skipped = 0
    let failed = 0

    for (const record of eligible) {
      const claimed = await claimAttestationForProcessing(record.id)
      if (!claimed) {
        this.logger.info(`Record ${record.id} already claimed or not eligible, skipping`)
        skipped++
        continue
      }

      const result = await this.processAttestation(claimed)
      if (result === 'attested') {
        attested++
      } else if (result === 'skipped') {
        skipped++
      } else {
        failed++
      }

      if (delayMs > 0 && eligible.indexOf(record) < eligible.length - 1) {
        await this.sleep(delayMs)
      }
    }

    this.logger.info(
      `Sweep completed: attested=${attested} skipped=${skipped} failed=${failed} total=${eligible.length}`
    )
  }

  private async recoverStaleRecords() {
    const staleThresholdMinutes = 30
    const stale = await findStaleProcessingAttestations({
      thresholdMinutes: staleThresholdMinutes,
      limit: 100,
    })

    if (stale.length > 0) {
      this.logger.info(
        `Found ${stale.length} stale processing records (>${staleThresholdMinutes}min), attempting recovery`
      )
      for (const { id } of stale) {
        await recoverStaleAttestation(id)
      }
    }
  }

  private async processAttestation(
    claimed: Awaited<ReturnType<typeof claimAttestationForProcessing>>
  ): Promise<'attested' | 'skipped' | 'failed'> {
    if (!claimed) return 'skipped'

    const onChain = await isInstitutionOnChainExecution(claimed.institutionId)
    if (!onChain) {
      this.logger.info(
        `Student ${claimed.studentId} institution ${claimed.institutionId} not on-chain, skipping`
      )
      await markAttestationFailed(claimed.id, 'Institution not on-chain')
      return 'skipped'
    }

    const student = await User.find(claimed.studentId)
    if (!student?.walletPublicKey) {
      this.logger.info(`Student ${claimed.studentId} has no wallet, skipping`)
      await markAttestationFailed(claimed.id, 'Student wallet missing')
      return 'skipped'
    }

    try {
      const connection = createSasConnection()
      const signer = loadSasAuthorizedSignerKeypair()
      const credentialPda = await resolveCredentialPda(signer)
      const schemaPda = await resolveMilestoneSchemaPda(credentialPda)
      const seasonId = await getActiveSeasonId(connection)

      const achHash = achievementHash(claimed.achievementKey, claimed.studentId)

      const data = buildMilestoneData({
        institutionId: claimed.institutionId,
        studentHash: studentIdHash(claimed.studentId),
        achievementKey: claimed.achievementKey,
        threshold: claimed.threshold,
        issuedAt: Math.floor(Date.now() / 1000),
        seasonId,
      })

      const attest = await createMilestoneAttestation({
        connection,
        authorizedSigner: signer,
        credentialPda,
        schemaPda,
        achievementHash: achHash,
        data,
      })

      await markAttestationSucceeded(claimed.id, attest.attestationPda, attest.signature ?? null)

      this.logger.success(
        `Attested student=${claimed.studentId} institution=${claimed.institutionId} pda=${attest.attestationPda}`
      )
      if (attest.signature && attest.signature !== 'existing') {
        this.logger.info(`  tx: ${explorerTxUrl(attest.signature)}`)
      }

      return 'attested'
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await markAttestationFailed(claimed.id, message)
      this.logger.error(
        `Failed student=${claimed.studentId} institution=${claimed.institutionId}: ${message}`
      )
      return 'failed'
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
