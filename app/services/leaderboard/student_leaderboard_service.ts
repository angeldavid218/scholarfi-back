import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'

export type StudentLeaderboardEntry = {
  rank: number
  studentId: number
  displayName: string
  points: number
  contributionCount: number
  isCurrentUser: boolean
  hasDiploma: boolean
}

export type StudentLeaderboardResult = {
  institutionId: number
  entries: StudentLeaderboardEntry[]
  currentUser: {
    rank: number | null
    points: number
    contributionCount: number
  }
}

/**
 * Institution-scoped outstanding-student board from confirmed mint ledger.
 * On-chain StudentScore is the verifiable write path; MVP reads Postgres for speed.
 */
export async function getInstitutionStudentLeaderboard(params: {
  institutionId: number
  currentUserId: number
  limit?: number
}): Promise<StudentLeaderboardResult> {
  const limit = params.limit ?? 10

  const rows = await db
    .from('token_transactions as tt')
    .join('users as u', 'u.id', 'tt.user_id')
    .where('tt.institution_id', params.institutionId)
    .andWhere('tt.type', 'mint')
    .andWhere('tt.status', 'confirmed')
    .whereNotNull('tt.achievement_id')
    .groupBy('tt.user_id', 'u.full_name', 'u.email')
    .select('tt.user_id as student_id')
    .select('u.full_name')
    .select('u.email')
    .select(db.raw('SUM(tt.amount)::int as points'))
    .select(db.raw('COUNT(*)::int as contribution_count'))
    .orderBy('points', 'desc')
    .orderBy('contribution_count', 'desc')

  const ranked = rows.map((row, index) => {
    const studentId = Number(row.student_id)
    const fullName = typeof row.full_name === 'string' ? row.full_name.trim() : ''
    const email = typeof row.email === 'string' ? row.email : ''
    const displayName =
      fullName || (email.includes('@') ? email.split('@')[0] : email) || `Estudiante #${studentId}`

    return {
      rank: index + 1,
      studentId,
      displayName,
      points: Number(row.points ?? 0),
      contributionCount: Number(row.contribution_count ?? 0),
      isCurrentUser: studentId === params.currentUserId,
      hasDiploma: false as boolean,
    } satisfies StudentLeaderboardEntry
  })

  const current = ranked.find((entry) => entry.isCurrentUser)
  const entries = ranked.slice(0, limit)

  if (current && !entries.some((entry) => entry.studentId === current.studentId)) {
    // Keep current user visible even outside top N
    entries.push(current)
  }

  const diplomaStudentIds = entries.map((entry) => entry.studentId)
  if (diplomaStudentIds.length > 0) {
    try {
      const diplomaRows = await db
        .from('student_diploma_mints')
        .where('institution_id', params.institutionId)
        .andWhere('status', 'confirmed')
        .whereIn('student_id', diplomaStudentIds)
        .select('student_id')
      const diplomaSet = new Set(diplomaRows.map((row) => Number(row.student_id)))
      for (const entry of entries) {
        entry.hasDiploma = diplomaSet.has(entry.studentId)
      }
      if (current) current.hasDiploma = diplomaSet.has(current.studentId)
    } catch (error) {
      // Ranking must still load if diploma migrations have not been applied yet.
      const code = (error as { code?: string })?.code
      if (code !== '42P01') throw error
    }
  }

  return {
    institutionId: params.institutionId,
    entries,
    currentUser: {
      rank: current?.rank ?? null,
      points: current?.points ?? 0,
      contributionCount: current?.contributionCount ?? 0,
    },
  }
}

export async function resolveLeaderboardInstitutionId(user: User): Promise<number | null> {
  return user.institutionId ?? null
}
