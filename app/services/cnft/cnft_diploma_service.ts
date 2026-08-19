import { DateTime } from 'luxon'
import tokenConfig, { assertCnftMintConfig } from '#config/token'
import Institution from '#models/institution'
import StudentDiplomaMint, {
  OUTSTANDING_STUDENT_DIPLOMA_KIND,
} from '#models/student_diploma_mint'
import User from '#models/user'
import { isInstitutionOnChainExecution, makeTokenServiceForInstitution } from '#services/tokens/factory'
import { getInstitutionStudentLeaderboard } from '#services/leaderboard/student_leaderboard_service'
import { createCnftUmi } from '#services/cnft/umi_client'
import { mintearCnft, truncateUtf8Bytes, MAX_CNFT_NAME_BYTES } from '#services/cnft/cnft_funciones'
import {
  achievementTypeForKind,
  DIPLOMA_ACHIEVEMENT_TYPES,
  type DiplomaAchievementTypeKey,
} from '#services/cnft/diploma_achievement_types'
import { buildDiplomaSvg, buildRecognitionId } from '#services/cnft/diploma_artwork'
import env from '#start/env'

export class CnftDiplomaError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number = 422
  ) {
    super(message)
    this.name = 'CnftDiplomaError'
  }
}

export type DiplomaView = {
  id: number
  kind: string
  achievementType: DiplomaAchievementTypeKey
  achievementLabel: string
  academicPeriod: string
  recognitionId: string
  issueDate: string
  institutionName: string
  studentId: number
  displayName: string
  points: number
  rank: number
  assetId: string | null
  merkleTree: string | null
  leafIndex: number | null
  signature: string | null
  metadataUri: string | null
  imageUri: string | null
  status: string
  explorerUrl: string | null
  assetExplorerUrl: string | null
  mintedAt: string | null
  errorMessage: string | null
}

export type OutstandingPreview = {
  onChainEnabled: boolean
  treeConfigured: boolean
  institutionName: string
  academicPeriod: string
  achievementType: DiplomaAchievementTypeKey
  achievementLabel: string
  currentBest: {
    studentId: number
    displayName: string
    points: number
    rank: number
    contributionCount: number
    walletPublicKey: string | null
  } | null
  existingDiploma: DiplomaView | null
}

function solanaCluster(): string {
  const rpc = tokenConfig.solanaRpcUrl.toLowerCase()
  if (rpc.includes('mainnet')) return 'mainnet-beta'
  return 'devnet'
}

function solscanTxUrl(signature: string): string {
  const cluster = solanaCluster()
  const base = `https://solscan.io/tx/${encodeURIComponent(signature)}`
  return cluster === 'mainnet-beta' ? base : `${base}?cluster=${cluster}`
}

function solscanTokenUrl(assetId: string): string {
  const cluster = solanaCluster()
  const base = `https://solscan.io/token/${encodeURIComponent(assetId)}`
  return cluster === 'mainnet-beta' ? base : `${base}?cluster=${cluster}`
}

function metadataBaseUrl(): string {
  return tokenConfig.cnftMetadataBaseUrl.replace(/\/$/, '')
}

export function diplomaMetadataUri(id: number): string {
  return `${metadataBaseUrl()}/api/v1/public/diplomas/${id}.json`
}

export function diplomaImageUri(id: number): string {
  return `${metadataBaseUrl()}/api/v1/public/diplomas/${id}.svg`
}

function issueDateIso(row: StudentDiplomaMint): string {
  const dt = row.updatedAt ?? row.createdAt
  return dt.toISODate() ?? DateTime.now().toISODate()!
}

export function toDiplomaView(row: StudentDiplomaMint, institutionName?: string): DiplomaView {
  const achievementType = achievementTypeForKind(row.kind)
  const achievement = DIPLOMA_ACHIEVEMENT_TYPES[achievementType]
  return {
    id: row.id,
    kind: row.kind,
    achievementType,
    achievementLabel: achievement.label,
    academicPeriod: tokenConfig.cnftAcademicPeriod,
    recognitionId: buildRecognitionId(row.id),
    issueDate: issueDateIso(row),
    institutionName: institutionName ?? '',
    studentId: row.studentId,
    displayName: row.displayName,
    points: row.points,
    rank: row.rank,
    assetId: row.assetId,
    merkleTree: row.merkleTree,
    leafIndex: row.leafIndex,
    signature: row.signature,
    metadataUri: row.metadataUri,
    imageUri: diplomaImageUri(row.id),
    status: row.status,
    explorerUrl: row.signature ? solscanTxUrl(row.signature) : null,
    assetExplorerUrl: row.assetId ? solscanTokenUrl(row.assetId) : null,
    mintedAt: row.updatedAt?.toISO() ?? row.createdAt.toISO(),
    errorMessage: row.errorMessage,
  }
}

/** Public Metaplex metadata — no grades, credits, or sensitive academic metrics. */
export function buildDiplomaMetadataJson(row: StudentDiplomaMint, institutionName: string) {
  const achievementType = achievementTypeForKind(row.kind)
  const achievement = DIPLOMA_ACHIEVEMENT_TYPES[achievementType]
  const academicPeriod = tokenConfig.cnftAcademicPeriod
  const issueDate = issueDateIso(row)
  const recognitionId = buildRecognitionId(row.id)
  const image = diplomaImageUri(row.id)

  return {
    name: `${achievement.label} — ${row.displayName}`,
    symbol: 'SFACH',
    description: achievement.subtitle,
    image,
    external_url: env.get('FRONTEND_URL') ?? undefined,
    attributes: [
      { trait_type: 'achievement_type', value: achievementType },
      { trait_type: 'Categoría', value: achievement.label },
      { trait_type: 'institution', value: institutionName },
      { trait_type: 'academic_period', value: academicPeriod },
      { trait_type: 'issue_date', value: issueDate },
      { trait_type: 'recognition_id', value: recognitionId },
    ],
    properties: {
      category: 'image',
      achievement_type: achievementType,
      institution: institutionName,
      academic_period: academicPeriod,
      issue_date: issueDate,
      recognition_id: recognitionId,
      verified_by: 'ScholarFi',
      chain: 'Solana',
      files: [{ uri: image, type: 'image/svg+xml' }],
    },
  }
}

export async function getDiplomaMetadataPayload(id: number) {
  const row = await StudentDiplomaMint.find(id)
  if (!row) return null
  const institution = await Institution.find(row.institutionId)
  return buildDiplomaMetadataJson(row, institution?.name ?? `Institución #${row.institutionId}`)
}

export async function getDiplomaArtworkSvg(id: number): Promise<string | null> {
  const row = await StudentDiplomaMint.find(id)
  if (!row) return null
  const institution = await Institution.find(row.institutionId)
  return buildDiplomaSvg({
    id: row.id,
    kind: row.kind,
    displayName: row.displayName,
    institutionName: institution?.name ?? `Institución #${row.institutionId}`,
    academicPeriod: tokenConfig.cnftAcademicPeriod,
    issuedAt: row.updatedAt ?? row.createdAt,
  })
}

export async function listStudentDiplomas(studentId: number, institutionId: number) {
  const institution = await Institution.find(institutionId)
  const institutionName = institution?.name ?? `Institución #${institutionId}`
  const rows = await StudentDiplomaMint.query()
    .where({ studentId, institutionId })
    .orderBy('id', 'desc')
  return rows.map((row) => toDiplomaView(row, institutionName))
}

export async function previewOutstandingDiploma(params: {
  institutionId: number
  actorUserId: number
}): Promise<OutstandingPreview> {
  const onChainEnabled = await isInstitutionOnChainExecution(params.institutionId)
  const treeConfigured = Boolean(tokenConfig.cnftMerkleTree)
  const achievementType = achievementTypeForKind(OUTSTANDING_STUDENT_DIPLOMA_KIND)
  const achievementLabel = DIPLOMA_ACHIEVEMENT_TYPES[achievementType].label
  const academicPeriod = tokenConfig.cnftAcademicPeriod
  const institution = await Institution.find(params.institutionId)
  const institutionName = institution?.name ?? `Institución #${params.institutionId}`

  const board = await getInstitutionStudentLeaderboard({
    institutionId: params.institutionId,
    currentUserId: params.actorUserId,
    limit: 1,
  })
  const best = board.entries[0] ?? null
  if (!best) {
    return {
      onChainEnabled,
      treeConfigured,
      institutionName,
      academicPeriod,
      achievementType,
      achievementLabel,
      currentBest: null,
      existingDiploma: null,
    }
  }

  const student = await User.find(best.studentId)
  const existing = await StudentDiplomaMint.query()
    .where({
      institutionId: params.institutionId,
      studentId: best.studentId,
    })
    .first()

  return {
    onChainEnabled,
    treeConfigured,
    institutionName,
    academicPeriod,
    achievementType,
    achievementLabel,
    currentBest: {
      studentId: best.studentId,
      displayName: best.displayName,
      points: best.points,
      rank: best.rank,
      contributionCount: best.contributionCount,
      walletPublicKey: student?.walletPublicKey ?? null,
    },
    existingDiploma: existing ? toDiplomaView(existing, institutionName) : null,
  }
}

export async function mintOutstandingDiploma(params: {
  institutionId: number
  actorUserId: number
}): Promise<{ diploma: DiplomaView; alreadyMinted: boolean }> {
  const onChain = await isInstitutionOnChainExecution(params.institutionId)
  if (!onChain) {
    throw new CnftDiplomaError(
      'CNFT_NOT_ENABLED',
      'Los diplomas cNFT requieren TOKEN_MODE=solana y wallets cripto habilitadas en la institución.',
      422
    )
  }

  try {
    assertCnftMintConfig()
  } catch (error) {
    throw new CnftDiplomaError(
      'CNFT_TREE_NOT_CONFIGURED',
      error instanceof Error ? error.message : String(error),
      422
    )
  }

  const preview = await previewOutstandingDiploma(params)
  if (!preview.currentBest) {
    throw new CnftDiplomaError(
      'CNFT_NO_OUTSTANDING_STUDENT',
      'Aún no hay un estudiante destacado en el ranking para emitir diploma.',
      422
    )
  }

  const best = preview.currentBest
  if (preview.existingDiploma?.status === 'confirmed') {
    return { diploma: preview.existingDiploma, alreadyMinted: true }
  }

  const tokenService = await makeTokenServiceForInstitution(params.institutionId)
  await tokenService.createWallet(String(best.studentId))
  const student = await User.findOrFail(best.studentId)
  if (!student.walletPublicKey) {
    throw new CnftDiplomaError(
      'CNFT_WALLET_MISSING',
      'No se pudo provisionar la wallet custodial del estudiante destacado.',
      422
    )
  }

  let row = preview.existingDiploma
    ? await StudentDiplomaMint.findOrFail(preview.existingDiploma.id)
    : new StudentDiplomaMint()

  row.institutionId = params.institutionId
  row.studentId = best.studentId
  row.kind = OUTSTANDING_STUDENT_DIPLOMA_KIND
  row.rank = best.rank
  row.points = best.points
  row.displayName = best.displayName
  row.status = 'pending'
  row.errorMessage = null
  row.merkleTree = tokenConfig.cnftMerkleTree
  await row.save()

  row.metadataUri = diplomaMetadataUri(row.id)
  await row.save()

  const achievement = DIPLOMA_ACHIEVEMENT_TYPES[preview.achievementType]

  try {
    const umi = createCnftUmi()
    const minted = await mintearCnft(
      umi,
      tokenConfig.cnftMerkleTree,
      {
        name: truncateUtf8Bytes(`${achievement.label} - ${best.displayName}`, MAX_CNFT_NAME_BYTES),
        uri: row.metadataUri,
        sellerFeeBasisPoints: 0,
      },
      student.walletPublicKey
    )

    row.assetId = minted.assetId.toString()
    row.leafIndex = minted.leafIndex
    row.signature = minted.signature
    row.status = 'confirmed'
    row.errorMessage = null
    await row.save()

    return { diploma: toDiplomaView(row, preview.institutionName), alreadyMinted: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    row.status = 'failed'
    row.errorMessage = message
    await row.save()
    throw new CnftDiplomaError('CNFT_MINT_FAILED', message, 502)
  }
}
