export type ClassroomSyncSkipReason =
  'already_rewarded' | 'no_grade' | 'grade_below_minimum' | 'budget_exhausted'

export interface EvaluateClassroomRewardEligibilityInput {
  alreadyRewarded: boolean
  grade: number | null | undefined
  minGrade: number
  remainingCredits: number
  rewardAmount: number
}

export function evaluateClassroomRewardEligibility(
  input: EvaluateClassroomRewardEligibilityInput
): ClassroomSyncSkipReason | null {
  if (input.alreadyRewarded) return 'already_rewarded'
  if (input.grade === null || input.grade === undefined) return 'no_grade'
  if (input.grade < input.minGrade) return 'grade_below_minimum'
  if (input.remainingCredits < input.rewardAmount || input.rewardAmount <= 0) {
    return 'budget_exhausted'
  }
  return null
}
