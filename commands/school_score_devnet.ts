import { BaseCommand, flags } from '@adonisjs/core/ace'
import { Connection, PublicKey } from '@solana/web3.js'
import {
  accountExists,
  buildInitializeIx,
  buildInitSchoolIx,
  buildRecordScoreIx,
  configPda,
  decodeGlobalConfig,
  decodeProcessedAchievement,
  decodeSchoolBoard,
  decodeStudentScore,
  explorerAddressUrl,
  explorerTxUrl,
  getLeaderboardProgramId,
  getSolanaRpcUrl,
  loadLeaderboardOracleKeypair,
  nameHashFromLabel,
  parseSubmissionHash,
  processedPda,
  schoolPda,
  sendIx,
  studentScorePda,
} from '#services/leaderboard/school_score_client'

export default class SchoolScoreDevnet extends BaseCommand {
  static commandName = 'school-score:devnet'
  static description =
    'Smoke-test scholarfi_school_leaderboard on Devnet (initialize / init_school / record_score)'
  static options = {
    startApp: true,
  }

  @flags.number({
    flagName: 'institution-id',
    description: 'Off-chain institution id used as SchoolBoard seed',
    default: 1,
  })
  declare institutionId: number

  @flags.number({
    flagName: 'points',
    description: 'Points to credit on record_score',
    default: 10,
  })
  declare points: number

  @flags.string({
    flagName: 'submission-hash',
    description: '32-byte submission hash as 64 hex chars (random if omitted)',
  })
  declare submissionHash: string | undefined

  @flags.boolean({
    flagName: 'skip-init',
    description: 'Skip initialize / init_school even if accounts are missing',
    default: false,
  })
  declare skipInit: boolean

  @flags.string({
    flagName: 'student',
    description: 'Student wallet pubkey (defaults to oracle pubkey)',
  })
  declare student: string | undefined

  async run() {
    const connection = new Connection(getSolanaRpcUrl(), 'confirmed')
    const oracle = loadLeaderboardOracleKeypair()
    const programId = getLeaderboardProgramId()
    const institutionId = BigInt(this.institutionId)
    const submissionHash = parseSubmissionHash(this.submissionHash)
    const student = this.student ? new PublicKey(this.student) : oracle.publicKey
    const nameHash = nameHashFromLabel(`poc-school-${this.institutionId}`)

    const [globalConfig] = configPda(programId)
    const [schoolBoard] = schoolPda(programId, institutionId)
    const [processedAchievement] = processedPda(programId, submissionHash)
    const [studentScore] = studentScorePda(programId, schoolBoard, student)

    this.logger.info(`RPC: ${connection.rpcEndpoint}`)
    this.logger.info(`Program: ${programId.toBase58()}`)
    this.logger.info(`Oracle / payer: ${oracle.publicKey.toBase58()}`)

    const balance = await connection.getBalance(oracle.publicKey)
    if (balance < 50_000_000) {
      this.logger.warning(
        `Oracle SOL balance is low (${balance / 1e9} SOL). Fund with: solana airdrop 2 ${oracle.publicKey.toBase58()} --url devnet`
      )
    }

    const signatures: string[] = []

    if (!this.skipInit) {
      if (!(await accountExists(connection, globalConfig))) {
        this.logger.info('GlobalConfig missing — sending initialize…')
        const sig = await sendIx(
          connection,
          oracle,
          buildInitializeIx({
            programId,
            globalConfig,
            authority: oracle.publicKey,
            oracle: oracle.publicKey,
            payer: oracle.publicKey,
          })
        )
        signatures.push(sig)
        this.logger.success(`initialize: ${sig}`)
      } else {
        this.logger.info('GlobalConfig already exists')
      }

      if (!(await accountExists(connection, schoolBoard))) {
        this.logger.info(
          `SchoolBoard missing for institution ${this.institutionId} — sending init_school…`
        )
        const sig = await sendIx(
          connection,
          oracle,
          buildInitSchoolIx({
            programId,
            globalConfig,
            schoolBoard,
            oracle: oracle.publicKey,
            payer: oracle.publicKey,
            institutionId,
            nameHash,
          })
        )
        signatures.push(sig)
        this.logger.success(`init_school: ${sig}`)
      } else {
        this.logger.info('SchoolBoard already exists')
      }
    }

    this.logger.info(
      `record_score points=${this.points} submission=${submissionHash.toString('hex')}`
    )
    const recordSig = await sendIx(
      connection,
      oracle,
      buildRecordScoreIx({
        programId,
        globalConfig,
        schoolBoard,
        processedAchievement,
        studentScore,
        oracle: oracle.publicKey,
        payer: oracle.publicKey,
        submissionHash,
        points: this.points,
        student,
      })
    )
    signatures.push(recordSig)
    this.logger.success(`record_score: ${recordSig}`)

    const configInfo = await connection.getAccountInfo(globalConfig)
    const boardInfo = await connection.getAccountInfo(schoolBoard)
    const processedInfo = await connection.getAccountInfo(processedAchievement)
    const studentScoreInfo = await connection.getAccountInfo(studentScore)
    if (!configInfo || !boardInfo || !processedInfo || !studentScoreInfo) {
      throw new Error('Expected PDAs missing after transactions')
    }

    const config = decodeGlobalConfig(Buffer.from(configInfo.data))
    const board = decodeSchoolBoard(Buffer.from(boardInfo.data))
    const processed = decodeProcessedAchievement(Buffer.from(processedInfo.data))
    const studentAcc = decodeStudentScore(Buffer.from(studentScoreInfo.data))

    this.logger.info('--- GlobalConfig ---')
    this.logger.info(`authority=${config.authority.toBase58()}`)
    this.logger.info(`oracle=${config.oracle.toBase58()}`)
    this.logger.info(`season_id=${config.seasonId} paused=${config.paused}`)

    this.logger.info('--- SchoolBoard ---')
    this.logger.info(`institution_id=${board.institutionId}`)
    this.logger.info(`total_points=${board.totalPoints}`)
    this.logger.info(`achievement_count=${board.achievementCount}`)
    this.logger.info(`season_id=${board.seasonId} last_updated=${board.lastUpdated}`)

    this.logger.info('--- ProcessedAchievement ---')
    this.logger.info(`points=${processed.points} student=${processed.student.toBase58()}`)

    this.logger.info('--- StudentScore ---')
    this.logger.info(
      `points=${studentAcc.points} contributions=${studentAcc.contributionCount} student=${studentAcc.student.toBase58()}`
    )

    this.logger.info('--- Explorer ---')
    this.logger.info(`program: ${explorerAddressUrl(programId.toBase58())}`)
    this.logger.info(`GlobalConfig: ${explorerAddressUrl(globalConfig.toBase58())}`)
    this.logger.info(`SchoolBoard: ${explorerAddressUrl(schoolBoard.toBase58())}`)
    this.logger.info(`ProcessedAchievement: ${explorerAddressUrl(processedAchievement.toBase58())}`)
    this.logger.info(`StudentScore: ${explorerAddressUrl(studentScore.toBase58())}`)
    for (const sig of signatures) {
      this.logger.info(`tx: ${explorerTxUrl(sig)}`)
    }
  }
}
