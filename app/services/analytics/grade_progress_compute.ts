/**
 * Pure half-split grade progress classification from normalized Classroom grades.
 */

export type GradeProgressCategory =
  | 'improving'
  | 'maintaining'
  | 'insufficient_data'
  | 'none'

export interface GradedSubmissionInput {
  grade: number
  maxPoints: number | null
  /** Prefer submitted_at; fall back to grade_checked_at when sorting. */
  at: Date
}

export interface GradeProgressResult {
  category: GradeProgressCategory
  gradedCount: number
  earlyAvg: number | null
  lateAvg: number | null
  delta: number | null
}

export const MIN_GRADED_FOR_PROGRESS = 4
export const IMPROVING_DELTA_THRESHOLD = 10
export const MAINTAINING_BAND = 5

/** Normalize absolute Classroom points to 0–100. Returns null when maxPoints is missing/invalid. */
export function normalizeGradeToPercent(grade: number, maxPoints: number | null): number | null {
  if (maxPoints === null || maxPoints === undefined || !(maxPoints > 0)) return null
  if (!Number.isFinite(grade)) return null
  return (grade / maxPoints) * 100
}

function average(values: number[]): number {
  const sum = values.reduce((acc, value) => acc + value, 0)
  return sum / values.length
}

/**
 * Classify a student's academic progress from chronological normalized grades.
 * Grades without maxPoints are skipped. Odd counts put the middle item in the late half.
 */
export function computeStudentGradeProgress(
  submissions: GradedSubmissionInput[]
): GradeProgressResult {
  const normalized = submissions
    .map((row) => {
      const percent = normalizeGradeToPercent(row.grade, row.maxPoints)
      if (percent === null) return null
      return { percent, at: row.at.getTime() }
    })
    .filter((row): row is { percent: number; at: number } => row !== null)
    .sort((a, b) => a.at - b.at)

  const gradedCount = normalized.length
  if (gradedCount < MIN_GRADED_FOR_PROGRESS) {
    return {
      category: 'insufficient_data',
      gradedCount,
      earlyAvg: null,
      lateAvg: null,
      delta: null,
    }
  }

  const mid = Math.floor(gradedCount / 2)
  const early = normalized.slice(0, mid).map((row) => row.percent)
  const late = normalized.slice(mid).map((row) => row.percent)
  const earlyAvg = average(early)
  const lateAvg = average(late)
  const delta = lateAvg - earlyAvg

  let category: GradeProgressCategory = 'none'
  if (delta >= IMPROVING_DELTA_THRESHOLD) {
    category = 'improving'
  } else if (Math.abs(delta) <= MAINTAINING_BAND) {
    category = 'maintaining'
  }

  return {
    category,
    gradedCount,
    earlyAvg,
    lateAvg,
    delta,
  }
}
