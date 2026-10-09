import {
  buildAchievementData,
  createAchievementAttestation,
  createSasConnection,
  loadSasAuthorizedSignerKeypair,
  resolveCredentialPda,
  resolveSchemaPda,
} from '#services/attestation/sas_attestation_client'
import { submissionHash, taskHash } from '#services/attestation/hashes'
import { getActiveSeasonId } from '#services/leaderboard/leaderboard_score_service'

export type IssueAchievementAttestationParams = {
  institutionId: number
  submissionId: number
  taskId: number
  points: number
  studentWallet: string
  seasonId?: number | bigint
}

export type IssueAchievementAttestationResult = {
  submissionHash: Buffer
  attestationPda: string
  attestationSignature: string | null
  created: boolean
  nonce: string
  seasonId: bigint
}

/**
 * Issue (or reuse) a SAS attestation for an approved achievement.
 */
export async function issueAchievementAttestation(
  params: IssueAchievementAttestationParams
): Promise<IssueAchievementAttestationResult> {
  const connection = createSasConnection()
  const signer = loadSasAuthorizedSignerKeypair()
  const credentialPda = await resolveCredentialPda(signer)
  const schemaPda = await resolveSchemaPda(credentialPda)

  const subHash = submissionHash(params.submissionId)
  const tHash = taskHash(params.taskId)
  const seasonId =
    params.seasonId !== undefined ? BigInt(params.seasonId) : await getActiveSeasonId(connection)

  const data = buildAchievementData({
    institutionId: params.institutionId,
    submissionHash: subHash,
    taskHash: tHash,
    points: params.points,
    issuedAt: Math.floor(Date.now() / 1000),
    seasonId,
  })

  const result = await createAchievementAttestation({
    connection,
    authorizedSigner: signer,
    credentialPda,
    schemaPda,
    submissionHash: subHash,
    data,
  })

  return {
    submissionHash: subHash,
    attestationPda: result.attestationPda,
    attestationSignature: result.signature,
    created: result.created,
    nonce: result.nonce,
    seasonId,
  }
}
