import {
  accountExists,
  buildInitSchoolIx,
  buildRecordScoreIx,
  configPda,
  decodeGlobalConfig,
  getLeaderboardProgramId,
  getSolanaRpcUrl,
  loadLeaderboardOracleKeypair,
  nameHashFromLabel,
  processedPda,
  schoolPda,
  sendIx,
  studentScorePda,
} from '#services/leaderboard/school_score_client'
import { Connection, PublicKey } from '@solana/web3.js'

export async function getActiveSeasonId(connection?: Connection): Promise<bigint> {
  const conn = connection ?? new Connection(getSolanaRpcUrl(), 'confirmed')
  const programId = getLeaderboardProgramId()
  const [globalConfig] = configPda(programId)
  const info = await conn.getAccountInfo(globalConfig)
  if (!info) {
    return 1n
  }
  return decodeGlobalConfig(Buffer.from(info.data)).seasonId
}

export async function ensureSchoolBoard(params: {
  connection: Connection
  institutionId: number
}): Promise<{ schoolBoard: PublicKey; initSignature: string | null }> {
  const oracle = loadLeaderboardOracleKeypair()
  const programId = getLeaderboardProgramId()
  const [globalConfig] = configPda(programId)
  const [schoolBoard] = schoolPda(programId, BigInt(params.institutionId))

  if (!(await accountExists(params.connection, globalConfig))) {
    throw new Error(
      'Leaderboard GlobalConfig missing — run `node ace school-score:devnet` once to initialize'
    )
  }

  if (await accountExists(params.connection, schoolBoard)) {
    return { schoolBoard, initSignature: null }
  }

  const initSignature = await sendIx(
    params.connection,
    oracle,
    buildInitSchoolIx({
      programId,
      globalConfig,
      schoolBoard,
      oracle: oracle.publicKey,
      payer: oracle.publicKey,
      institutionId: BigInt(params.institutionId),
      nameHash: nameHashFromLabel(`school-${params.institutionId}`),
    })
  )
  return { schoolBoard, initSignature }
}

export async function recordScoreForSubmission(params: {
  connection: Connection
  institutionId: number
  submissionHash: Buffer
  points: number
  studentWallet: string
}): Promise<{
  signature: string | null
  schoolBoardPda: string
  processedAchievementPda: string
  studentScorePda: string
  alreadyProcessed: boolean
}> {
  const oracle = loadLeaderboardOracleKeypair()
  const programId = getLeaderboardProgramId()
  const [globalConfig] = configPda(programId)
  const { schoolBoard } = await ensureSchoolBoard({
    connection: params.connection,
    institutionId: params.institutionId,
  })
  const student = new PublicKey(params.studentWallet)
  const [processedAchievement] = processedPda(programId, params.submissionHash)
  const [studentScore] = studentScorePda(programId, schoolBoard, student)

  if (await accountExists(params.connection, processedAchievement)) {
    return {
      signature: null,
      schoolBoardPda: schoolBoard.toBase58(),
      processedAchievementPda: processedAchievement.toBase58(),
      studentScorePda: studentScore.toBase58(),
      alreadyProcessed: true,
    }
  }

  const signature = await sendIx(
    params.connection,
    oracle,
    buildRecordScoreIx({
      programId,
      globalConfig,
      schoolBoard,
      processedAchievement,
      studentScore,
      oracle: oracle.publicKey,
      payer: oracle.publicKey,
      submissionHash: params.submissionHash,
      points: params.points,
      student,
    })
  )

  return {
    signature,
    schoolBoardPda: schoolBoard.toBase58(),
    processedAchievementPda: processedAchievement.toBase58(),
    studentScorePda: studentScore.toBase58(),
    alreadyProcessed: false,
  }
}
