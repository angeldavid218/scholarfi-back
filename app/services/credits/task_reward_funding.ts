import { assertInstitutionCanFundTaskReward, getInstitutionCreditPoolSummary } from '#services/credits/institution_credit_pool_service'
import { assertTeacherCanFundTaskReward, getTeacherCreditPoolSummary } from '#services/credits/teacher_credit_pool_service'
import type { DbTransaction, RewardFundingSource } from '#services/credits/types'

export interface ResolvePreferredRewardFundingInput {
  teacherId: number
  institutionId: number
  client?: DbTransaction
}

export interface PreferredRewardFunding {
  fundingSource: RewardFundingSource
  remainingCredits: number
}

export interface AssertPreferredTaskRewardFundingInput {
  teacherId: number
  institutionId: number
  rewardAmount: number
  client?: DbTransaction
}

/**
 * Same funding rule as task create/import: use the teacher pool when the teacher
 * has allocated credits; otherwise fund from the institution pool.
 */
export async function resolvePreferredRewardFunding(
  input: ResolvePreferredRewardFundingInput
): Promise<PreferredRewardFunding> {
  const teacherPool = await getTeacherCreditPoolSummary(input.teacherId, input.client)
  if (teacherPool && teacherPool.allocatedCredits > 0) {
    return {
      fundingSource: 'teacher',
      remainingCredits: teacherPool.remainingCredits,
    }
  }

  const institutionPool = await getInstitutionCreditPoolSummary(input.institutionId, input.client)
  return {
    fundingSource: 'institution',
    remainingCredits: institutionPool.remainingCredits,
  }
}

export async function remainingCreditsForFundingSource(input: {
  fundingSource: RewardFundingSource
  teacherId: number
  institutionId: number
  client?: DbTransaction
}): Promise<number> {
  if (input.fundingSource === 'teacher') {
    const pool = await getTeacherCreditPoolSummary(input.teacherId, input.client)
    return pool?.remainingCredits ?? 0
  }

  const pool = await getInstitutionCreditPoolSummary(input.institutionId, input.client)
  return pool.remainingCredits
}

export async function assertPreferredTaskRewardFunding(
  input: AssertPreferredTaskRewardFundingInput
): Promise<void> {
  const teacherPool = await getTeacherCreditPoolSummary(input.teacherId, input.client)
  if (teacherPool && teacherPool.allocatedCredits > 0) {
    await assertTeacherCanFundTaskReward(input.teacherId, input.rewardAmount, input.client)
    return
  }

  await assertInstitutionCanFundTaskReward(input.institutionId, input.rewardAmount, input.client)
}
