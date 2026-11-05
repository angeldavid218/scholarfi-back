import { test } from '@japa/runner'
import { buildGradeProgressSummary } from '#services/analytics/grade_progress_service'

test.group('buildGradeProgressSummary', () => {
  test('counts categories and averages deltas', ({ assert }) => {
    const summary = buildGradeProgressSummary([
      { category: 'improving', delta: 20 },
      { category: 'improving', delta: 10 },
      { category: 'maintaining', delta: 2 },
      { category: 'insufficient_data', delta: null },
      { category: 'none', delta: -15 },
    ])

    assert.equal(summary.total, 5)
    assert.equal(summary.improving, 2)
    assert.equal(summary.maintaining, 1)
    assert.equal(summary.insufficientData, 1)
    assert.equal(summary.none, 1)
    assert.approximately(summary.avgDelta!, (20 + 10 + 2 - 15) / 4, 0.001)
  })

  test('returns null avgDelta when no deltas', ({ assert }) => {
    const summary = buildGradeProgressSummary([
      { category: 'insufficient_data', delta: null },
      { category: 'insufficient_data', delta: null },
    ])
    assert.equal(summary.total, 2)
    assert.equal(summary.insufficientData, 2)
    assert.isNull(summary.avgDelta)
  })

  test('empty list yields zeros', ({ assert }) => {
    const summary = buildGradeProgressSummary([])
    assert.deepEqual(summary, {
      total: 0,
      improving: 0,
      maintaining: 0,
      insufficientData: 0,
      none: 0,
      avgDelta: null,
    })
  })
})
