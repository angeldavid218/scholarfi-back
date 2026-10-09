import { evaluateClassroomRewardEligibility } from '#services/integrations/google_classroom/sync_eligibility'
import { test } from '@japa/runner'

test.group('Google Classroom reward eligibility', () => {
  test('skips already rewarded submissions first', ({ assert }) => {
    assert.equal(
      evaluateClassroomRewardEligibility({
        alreadyRewarded: true,
        grade: 10,
        minGrade: 6,
        remainingCredits: 100,
        rewardAmount: 10,
      }),
      'already_rewarded'
    )
  })

  test('skips when grade is missing', ({ assert }) => {
    assert.equal(
      evaluateClassroomRewardEligibility({
        alreadyRewarded: false,
        grade: null,
        minGrade: 6,
        remainingCredits: 100,
        rewardAmount: 10,
      }),
      'no_grade'
    )
    assert.equal(
      evaluateClassroomRewardEligibility({
        alreadyRewarded: false,
        grade: undefined,
        minGrade: 6,
        remainingCredits: 100,
        rewardAmount: 10,
      }),
      'no_grade'
    )
  })

  test('skips when grade is below the minimum', ({ assert }) => {
    assert.equal(
      evaluateClassroomRewardEligibility({
        alreadyRewarded: false,
        grade: 5,
        minGrade: 6,
        remainingCredits: 100,
        rewardAmount: 10,
      }),
      'grade_below_minimum'
    )
  })

  test('skips when remaining credits cannot cover the reward', ({ assert }) => {
    assert.equal(
      evaluateClassroomRewardEligibility({
        alreadyRewarded: false,
        grade: 8,
        minGrade: 6,
        remainingCredits: 9,
        rewardAmount: 10,
      }),
      'budget_exhausted'
    )
    assert.equal(
      evaluateClassroomRewardEligibility({
        alreadyRewarded: false,
        grade: 8,
        minGrade: 6,
        remainingCredits: 100,
        rewardAmount: 0,
      }),
      'budget_exhausted'
    )
  })

  test('returns null when the submission is eligible', ({ assert }) => {
    assert.isNull(
      evaluateClassroomRewardEligibility({
        alreadyRewarded: false,
        grade: 6,
        minGrade: 6,
        remainingCredits: 10,
        rewardAmount: 10,
      })
    )
  })
})
