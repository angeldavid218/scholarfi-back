import { BaseCommand, flags } from '@adonisjs/core/ace'
import {
  buildAchievementData,
  createAchievementAttestation,
  createSasConnection,
  explorerAddressUrl,
  explorerTxUrl,
  fetchAndDecodeAchievementAttestation,
  loadSasAuthorizedSignerKeypair,
  resolveCredentialPda,
  resolveSchemaPda,
} from '#services/attestation/sas_attestation_client'
import { hashToHex, submissionHash, taskHash } from '#services/attestation/hashes'
import { getActiveSeasonId, recordScoreForSubmission } from '#services/leaderboard/leaderboard_score_service'

export default class SasAttest extends BaseCommand {
  static commandName = 'sas:attest'
  static description =
    'Create a ScholarFi achievement attestation on Devnet (optional --record-score)'
  static options = {
    startApp: true,
  }

  @flags.number({
    flagName: 'institution-id',
    description: 'Institution id for attestation + school board',
    default: 1,
  })
  declare institutionId: number

  @flags.number({
    flagName: 'submission-id',
    description: 'Off-chain submission id used for submission_hash',
    default: 900001,
  })
  declare submissionId: number

  @flags.number({
    flagName: 'task-id',
    description: 'Off-chain task id used for task_hash',
    default: 900001,
  })
  declare taskId: number

  @flags.number({
    flagName: 'points',
    description: 'Points to attest / score',
    default: 10,
  })
  declare points: number

  @flags.string({
    flagName: 'student',
    description: 'Student wallet (defaults to authorized signer pubkey)',
  })
  declare student: string | undefined

  @flags.boolean({
    flagName: 'record-score',
    description: 'Also call leaderboard record_score with the same submission_hash',
    default: false,
  })
  declare recordScore: boolean

  async run() {
    const connection = createSasConnection()
    const signer = loadSasAuthorizedSignerKeypair()
    const studentWallet = this.student ?? signer.publicKey.toBase58()
    const credentialPda = await resolveCredentialPda(signer)
    const schemaPda = await resolveSchemaPda(credentialPda)
    const subHash = submissionHash(this.submissionId)
    const tHash = taskHash(this.taskId)
    const seasonId = await getActiveSeasonId(connection)

    this.logger.info(`RPC: ${connection.rpcEndpoint}`)
    this.logger.info(`Credential: ${credentialPda}`)
    this.logger.info(`Schema: ${schemaPda}`)
    this.logger.info(`submission_hash: ${hashToHex(subHash)}`)
    this.logger.info(`student: ${studentWallet}`)

    const data = buildAchievementData({
      institutionId: this.institutionId,
      submissionHash: subHash,
      taskHash: tHash,
      points: this.points,
      issuedAt: Math.floor(Date.now() / 1000),
      seasonId,
    })

    const attest = await createAchievementAttestation({
      connection,
      authorizedSigner: signer,
      credentialPda,
      schemaPda,
      submissionHash: subHash,
      data,
    })

    if (attest.created) {
      this.logger.success(`Attestation created: ${attest.signature}`)
    } else {
      this.logger.info('Attestation already exists (idempotent)')
    }

    const decoded = await fetchAndDecodeAchievementAttestation({
      connection,
      attestationPda: attest.attestationPda,
      schemaPda,
    })
    this.logger.info('--- Attestation data ---')
    this.logger.info(
      `institution_id=${decoded.institution_id} points=${decoded.points} season_id=${decoded.season_id}`
    )

    this.logger.info('--- Explorer ---')
    this.logger.info(`attestation: ${explorerAddressUrl(attest.attestationPda)}`)
    if (attest.signature) this.logger.info(`tx: ${explorerTxUrl(attest.signature)}`)

    if (this.recordScore) {
      const scored = await recordScoreForSubmission({
        connection,
        institutionId: this.institutionId,
        submissionHash: subHash,
        points: this.points,
        studentWallet,
      })
      if (scored.alreadyProcessed) {
        this.logger.info('Leaderboard already processed this submission_hash')
      } else {
        this.logger.success(`record_score: ${scored.signature}`)
      }
      this.logger.info(`SchoolBoard: ${explorerAddressUrl(scored.schoolBoardPda)}`)
      this.logger.info(`ProcessedAchievement: ${explorerAddressUrl(scored.processedAchievementPda)}`)
      if (scored.signature) this.logger.info(`leaderboard tx: ${explorerTxUrl(scored.signature)}`)
    }
  }
}
