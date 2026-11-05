import { test } from '@japa/runner'
import {
  computeStudentGradeProgress,
  IMPROVING_DELTA_THRESHOLD,
  MAINTAINING_BAND,
  MIN_GRADED_FOR_PROGRESS,
  normalizeGradeToPercent,
} from '#services/analytics/grade_progress_compute'

function at(day: number): Date {
  return new Date(`2026-01-${String(day).padStart(2, '0')}T12:00:00.000Z`)
}

test.group('grade progress compute', () => {
  test('normalizeGradeToPercent skips missing maxPoints', ({ assert }) => {
    assert.isNull(normalizeGradeToPercent(8, null))
    assert.isNull(normalizeGradeToPercent(8, 0))
    assert.equal(normalizeGradeToPercent(8, 10), 80)
  })

  test('insufficient_data when fewer than minimum graded points', ({ assert }) => {
    const result = computeStudentGradeProgress([
      { grade: 5, maxPoints: 10, at: at(1) },
      { grade: 6, maxPoints: 10, at: at(2) },
      { grade: 7, maxPoints: 10, at: at(3) },
    ])
    assert.equal(result.category, 'insufficient_data')
    assert.equal(result.gradedCount, 3)
    assert.isNull(result.delta)
  })

  test('skips grades without maxPoints toward graded count', ({ assert }) => {
    const result = computeStudentGradeProgress([
      { grade: 5, maxPoints: 10, at: at(1) },
      { grade: 6, maxPoints: null, at: at(2) },
      { grade: 7, maxPoints: 10, at: at(3) },
      { grade: 8, maxPoints: 10, at: at(4) },
      { grade: 9, maxPoints: 10, at: at(5) },
    ])
    assert.equal(result.gradedCount, 4)
    assert.isAbove(result.gradedCount, MIN_GRADED_FOR_PROGRESS - 1)
  })

  test('classifies improving when late half rises by threshold', ({ assert }) => {
    // early: 40, 50 → 45; late: 70, 80 → 75; delta 30
    const result = computeStudentGradeProgress([
      { grade: 4, maxPoints: 10, at: at(1) },
      { grade: 5, maxPoints: 10, at: at(2) },
      { grade: 7, maxPoints: 10, at: at(3) },
      { grade: 8, maxPoints: 10, at: at(4) },
    ])
    assert.equal(result.category, 'improving')
    assert.isAtLeast(result.delta!, IMPROVING_DELTA_THRESHOLD)
    assert.approximately(result.earlyAvg!, 45, 0.01)
    assert.approximately(result.lateAvg!, 75, 0.01)
  })

  test('classifies maintaining within band', ({ assert }) => {
    // early: 70, 72 → 71; late: 73, 74 → 73.5; delta 2.5
    const result = computeStudentGradeProgress([
      { grade: 7.0, maxPoints: 10, at: at(1) },
      { grade: 7.2, maxPoints: 10, at: at(2) },
      { grade: 7.3, maxPoints: 10, at: at(3) },
      { grade: 7.4, maxPoints: 10, at: at(4) },
    ])
    assert.equal(result.category, 'maintaining')
    assert.isAtMost(Math.abs(result.delta!), MAINTAINING_BAND)
  })

  test('classifies none when decline is outside maintaining band', ({ assert }) => {
    // early: 80, 90 → 85; late: 50, 40 → 45; delta -40
    const result = computeStudentGradeProgress([
      { grade: 8, maxPoints: 10, at: at(1) },
      { grade: 9, maxPoints: 10, at: at(2) },
      { grade: 5, maxPoints: 10, at: at(3) },
      { grade: 4, maxPoints: 10, at: at(4) },
    ])
    assert.equal(result.category, 'none')
    assert.isBelow(result.delta!, -MAINTAINING_BAND)
  })

  test('odd count puts middle grade in late half', ({ assert }) => {
    // 5 grades: early [40,50]=45; late [60,70,80]=70; delta 25
    const result = computeStudentGradeProgress([
      { grade: 4, maxPoints: 10, at: at(1) },
      { grade: 5, maxPoints: 10, at: at(2) },
      { grade: 6, maxPoints: 10, at: at(3) },
      { grade: 7, maxPoints: 10, at: at(4) },
      { grade: 8, maxPoints: 10, at: at(5) },
    ])
    assert.equal(result.gradedCount, 5)
    assert.approximately(result.earlyAvg!, 45, 0.01)
    assert.approximately(result.lateAvg!, 70, 0.01)
    assert.equal(result.category, 'improving')
  })

  test('sorts by time before splitting halves', ({ assert }) => {
    const result = computeStudentGradeProgress([
      { grade: 8, maxPoints: 10, at: at(4) },
      { grade: 4, maxPoints: 10, at: at(1) },
      { grade: 7, maxPoints: 10, at: at(3) },
      { grade: 5, maxPoints: 10, at: at(2) },
    ])
    assert.approximately(result.earlyAvg!, 45, 0.01)
    assert.approximately(result.lateAvg!, 75, 0.01)
    assert.equal(result.category, 'improving')
  })
})
