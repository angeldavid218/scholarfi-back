import { BaseCommand, flags } from '@adonisjs/core/ace'
import { tryAcquireGlobalLock } from '#services/cron/global_lock_service'
import {
  claimDiplomaForProcessing,
  findEligibleDiplomas,
  findStaleProcessingDiplomas,
  markDiplomaFailed,
  markDiplomaSucceeded,
  recoverStaleDiploma,
} from '#services/cnft/cnft_diploma_claim_service'
import { createCnftUmi } from '#services/cnft/umi_client'
import { mintearCnft, truncateUtf8Bytes, MAX_CNFT_NAME_BYTES } from '#services/cnft/cnft_funciones'
import {
  achievementTypeForKind,
  DIPLOMA_ACHIEVEMENT_TYPES,
} from '#services/cnft/diploma_achievement_types'
import { diplomaMetadataUri } from '#services/cnft/cnft_diploma_service'
import {
  isInstitutionOnChainExecution,
  makeTokenServiceForInstitution,
} from '#services/tokens/factory'
import User from '#models/user'
import tokenConfig from '#config/token'
import env from '#start/env'

export default class CnftMintSweep extends BaseCommand {
  static commandName = 'cnft:mint-sweep'
  static description =
    'Sweep outstanding diploma mints with locking and retry limits (cron-friendly)'
  static options = {
    startApp: true,
  }

  @flags.number({
    flagName: 'limit',
    description: 'Max diplomas to mint in this run',
    default: 5,
  })
  declare limit: number

  @flags.number({
    flagName: 'max-attempts',
    description: 'Max attempts before giving up on a failed mint',
    default: 3,
  })
  declare maxAttempts: number

  @flags.number({
    flagName: 'delay-ms',
    description: 'Delay in milliseconds between mints',
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
    const lock = await tryAcquireGlobalLock('cnft:mint-sweep')

    if (!lock.acquired) {
      this.logger.info('Another cnft:mint-sweep is already running. Exiting cleanly.')
      return
    }

    try {
      await this.executeSweep()
    } finally {
      await lock.release()
    }
  }

  private async executeSweep() {
    if (!tokenConfig.cnftMerkleTree) {
      this.logger.warning('CNFT_MERKLE_TREE not configured — mints will be skipped')
      return
    }

    const delayMs =
      this.delayMs ?? (env.get('CNFT_MINT_DELAY_MS') ? Number(env.get('CNFT_MINT_DELAY_MS')) : 2000)

    this.logger.info(
      `Starting cnft:mint-sweep: limit=${this.limit} maxAttempts=${this.maxAttempts} delayMs=${delayMs} institutionId=${this.institutionId ?? 'all'}`
    )

    if (this.recoverStale) {
      await this.recoverStaleRecords()
    }

    const eligible = await findEligibleDiplomas({
      institutionId: this.institutionId,
      maxAttempts: this.maxAttempts,
      limit: this.limit,
    })

    this.logger.info(`Found ${eligible.length} eligible diplomas`)

    let minted = 0
    let skipped = 0
    let failed = 0

    for (const record of eligible) {
      const claimed = await claimDiplomaForProcessing(record.id)
      if (!claimed) {
        this.logger.info(`Record ${record.id} already claimed or not eligible, skipping`)
        skipped++
        continue
      }

      const result = await this.processMint(claimed)
      if (result === 'minted') {
        minted++
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
      `Sweep completed: minted=${minted} skipped=${skipped} failed=${failed} total=${eligible.length}`
    )
  }

  private async recoverStaleRecords() {
    const staleThresholdMinutes = 30
    const stale = await findStaleProcessingDiplomas({
      thresholdMinutes: staleThresholdMinutes,
      limit: 100,
    })

    if (stale.length > 0) {
      this.logger.info(
        `Found ${stale.length} stale processing records (>${staleThresholdMinutes}min), attempting recovery`
      )
      for (const { id } of stale) {
        await recoverStaleDiploma(id)
      }
    }
  }

  private async processMint(
    claimed: Awaited<ReturnType<typeof claimDiplomaForProcessing>>
  ): Promise<'minted' | 'skipped' | 'failed'> {
    if (!claimed) return 'skipped'

    const onChain = await isInstitutionOnChainExecution(claimed.institutionId)
    if (!onChain) {
      this.logger.info(
        `Student ${claimed.studentId} institution ${claimed.institutionId} not on-chain, skipping`
      )
      await markDiplomaFailed(claimed.id, 'Institution not on-chain')
      return 'skipped'
    }

    try {
      const tokenService = await makeTokenServiceForInstitution(claimed.institutionId)
      await tokenService.createWallet(String(claimed.studentId))

      const student = await User.findOrFail(claimed.studentId)
      if (!student.walletPublicKey) {
        this.logger.info(`Student ${claimed.studentId} has no wallet after provisioning, skipping`)
        await markDiplomaFailed(claimed.id, 'Wallet provisioning failed')
        return 'skipped'
      }

      const achievementType = achievementTypeForKind(claimed.kind)
      const achievement = DIPLOMA_ACHIEVEMENT_TYPES[achievementType]

      const umi = createCnftUmi()
      const minted = await mintearCnft(
        umi,
        tokenConfig.cnftMerkleTree,
        {
          name: truncateUtf8Bytes(
            `${achievement.label} - ${claimed.displayName}`,
            MAX_CNFT_NAME_BYTES
          ),
          uri: claimed.metadataUri ?? diplomaMetadataUri(claimed.id),
          sellerFeeBasisPoints: 0,
        },
        student.walletPublicKey
      )

      await markDiplomaSucceeded(
        claimed.id,
        minted.assetId.toString(),
        minted.leafIndex,
        minted.signature
      )

      this.logger.success(
        `Minted diploma ${claimed.id} for student ${claimed.studentId}: asset=${minted.assetId}`
      )

      return 'minted'
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await markDiplomaFailed(claimed.id, message)
      this.logger.error(`Failed diploma ${claimed.id} for student ${claimed.studentId}: ${message}`)
      return 'failed'
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
