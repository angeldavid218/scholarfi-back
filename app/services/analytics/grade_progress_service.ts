import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import StudentGradeProgress from '#models/student_grade_progress'
import {
  computeStudentGradeProgress,
  type GradedSubmissionInput,
  type GradeProgressResult,
} from '#services/analytics/grade_progress_compute'

interface RawGradeRow {
  student_id: number
  external_grade: string | number | null
  submitted_at: Date | string | null
  grade_checked_at: Date | string | null
  sync_metadata: unknown
}

function parseMaxPoints(syncMetadata: unknown): number | null {
  let raw = syncMetadata
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!raw || typeof raw !== 'object') return null
  const maxPoints = (raw as { maxPoints?: unknown }).maxPoints
  if (typeof maxPoints === 'number' && Number.isFinite(maxPoints) && maxPoints > 0) {
    return maxPoints
  }
  if (typeof maxPoints === 'string' && maxPoints.trim() !== '') {
    const parsed = Number(maxPoints)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function decimalOrNull(value: number | null): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return value.toFixed(4)
}

export async function loadInstitutionGradedSubmissions(
  institutionId: number
): Promise<Map<number, GradedSubmissionInput[]>> {
  const rows = (await db
    .from('submissions as s')
    .join('tasks as t', 't.id', 's.task_id')
    .where('s.institution_id', institutionId)
    .whereNotNull('s.external_grade')
    .select(
      's.student_id',
      's.external_grade',
      's.submitted_at',
      's.grade_checked_at',
      't.sync_metadata'
    )) as RawGradeRow[]

  const byStudent = new Map<number, GradedSubmissionInput[]>()

  for (const row of rows) {
    const gradeRaw = row.external_grade
    const grade = typeof gradeRaw === 'number' ? gradeRaw : Number(gradeRaw)
    if (!Number.isFinite(grade)) continue

    const at =
      toDate(row.submitted_at) ?? toDate(row.grade_checked_at) ?? null
    if (!at) continue

    const list = byStudent.get(row.student_id) ?? []
    list.push({
      grade,
      maxPoints: parseMaxPoints(row.sync_metadata),
      at,
    })
    byStudent.set(row.student_id, list)
  }

  return byStudent
}

export async function upsertInstitutionGradeProgress(institutionId: number): Promise<{
  students: number
  improving: number
  maintaining: number
  insufficientData: number
  none: number
}> {
  const byStudent = await loadInstitutionGradedSubmissions(institutionId)
  const analyzedAt = DateTime.now()

  let improving = 0
  let maintaining = 0
  let insufficientData = 0
  let none = 0

  for (const [studentId, submissions] of byStudent) {
    const result: GradeProgressResult = computeStudentGradeProgress(submissions)
    if (result.category === 'improving') improving++
    else if (result.category === 'maintaining') maintaining++
    else if (result.category === 'insufficient_data') insufficientData++
    else none++

    const existing = await StudentGradeProgress.query()
      .where({ institutionId, studentId })
      .first()

    const row = existing ?? new StudentGradeProgress()
    row.institutionId = institutionId
    row.studentId = studentId
    row.category = result.category
    row.gradedCount = result.gradedCount
    row.earlyAvg = decimalOrNull(result.earlyAvg)
    row.lateAvg = decimalOrNull(result.lateAvg)
    row.delta = decimalOrNull(result.delta)
    row.analyzedAt = analyzedAt
    await row.save()
  }

  return {
    students: byStudent.size,
    improving,
    maintaining,
    insufficientData,
    none,
  }
}

export async function listInstitutionIdsWithGradedSubmissions(): Promise<number[]> {
  const rows = await db
    .from('submissions')
    .whereNotNull('external_grade')
    .distinct('institution_id')
    .select('institution_id')

  return rows
    .map((row: { institution_id: number }) => Number(row.institution_id))
    .filter((id) => Number.isInteger(id) && id > 0)
}

export interface GradeProgressListItem {
  studentId: number
  displayName: string
  category: string
  gradedCount: number
  earlyAvg: number | null
  lateAvg: number | null
  delta: number | null
  analyzedAt: string | null
  diplomaStatus: string | null
  diplomaId: number | null
}

export interface GradeProgressSummary {
  total: number
  improving: number
  maintaining: number
  insufficientData: number
  none: number
  avgDelta: number | null
}

/** Aggregate KPIs over a progress list (pure). */
export function buildGradeProgressSummary(
  students: Pick<GradeProgressListItem, 'category' | 'delta'>[]
): GradeProgressSummary {
  let improving = 0
  let maintaining = 0
  let insufficientData = 0
  let none = 0
  const deltas: number[] = []

  for (const row of students) {
    if (row.category === 'improving') improving++
    else if (row.category === 'maintaining') maintaining++
    else if (row.category === 'insufficient_data') insufficientData++
    else none++

    if (row.delta !== null && row.delta !== undefined && Number.isFinite(row.delta)) {
      deltas.push(row.delta)
    }
  }

  const avgDelta =
    deltas.length === 0
      ? null
      : deltas.reduce((acc, value) => acc + value, 0) / deltas.length

  return {
    total: students.length,
    improving,
    maintaining,
    insufficientData,
    none,
    avgDelta,
  }
}

/** Distinct students in groups where the teacher is assigned. */
export async function listTeacherStudentIds(
  institutionId: number,
  teacherId: number
): Promise<number[]> {
  const rows = await db
    .from('group_students as gs')
    .innerJoin('group_teachers as gt', 'gt.group_id', 'gs.group_id')
    .where('gt.teacher_id', teacherId)
    .where('gs.institution_id', institutionId)
    .distinct('gs.student_id')
    .select('gs.student_id')

  return rows
    .map((row: { student_id: number }) => Number(row.student_id))
    .filter((id) => Number.isInteger(id) && id > 0)
}

export async function listInstitutionGradeProgress(
  institutionId: number,
  options?: { studentIds?: number[] }
): Promise<GradeProgressListItem[]> {
  if (options?.studentIds !== undefined && options.studentIds.length === 0) {
    return []
  }

  let query = db
    .from('student_grade_progress as sgp')
    .join('users as u', 'u.id', 'sgp.student_id')
    .leftJoin('student_diploma_mints as sdm', function () {
      this.on('sdm.student_id', '=', 'sgp.student_id')
        .andOn('sdm.institution_id', '=', 'sgp.institution_id')
        .andOnVal('sdm.kind', 'progreso_academico')
    })
    .where('sgp.institution_id', institutionId)

  if (options?.studentIds !== undefined) {
    query = query.whereIn('sgp.student_id', options.studentIds)
  }

  const rows = await query
    .orderByRaw(
      `CASE sgp.category
        WHEN 'improving' THEN 0
        WHEN 'maintaining' THEN 1
        WHEN 'none' THEN 2
        ELSE 3
      END`
    )
    .orderBy('sgp.delta', 'desc')
    .select(
      'sgp.student_id',
      'u.full_name',
      'u.email',
      'sgp.category',
      'sgp.graded_count',
      'sgp.early_avg',
      'sgp.late_avg',
      'sgp.delta',
      'sgp.analyzed_at',
      'sdm.status as diploma_status',
      'sdm.id as diploma_id'
    )

  return rows.map((row: Record<string, unknown>) => {
    const fullName = typeof row.full_name === 'string' ? row.full_name.trim() : ''
    const email = typeof row.email === 'string' ? row.email : ''
    const displayName =
      fullName || (email.includes('@') ? email.split('@')[0] : email) || `Estudiante #${row.student_id}`

    const toNum = (value: unknown): number | null => {
      if (value === null || value === undefined || value === '') return null
      const n = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(n) ? n : null
    }

    const analyzedAt =
      row.analyzed_at instanceof Date
        ? row.analyzed_at.toISOString()
        : typeof row.analyzed_at === 'string'
          ? row.analyzed_at
          : null

    return {
      studentId: Number(row.student_id),
      displayName,
      category: String(row.category),
      gradedCount: Number(row.graded_count) || 0,
      earlyAvg: toNum(row.early_avg),
      lateAvg: toNum(row.late_avg),
      delta: toNum(row.delta),
      analyzedAt,
      diplomaStatus: row.diploma_status ? String(row.diploma_status) : null,
      diplomaId: row.diploma_id ? Number(row.diploma_id) : null,
    }
  })
}
