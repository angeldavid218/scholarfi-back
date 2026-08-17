import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

const CLASSROOM_ROSTER_EVIDENCE =
  'Inscrito en la clase vinculada a Google Classroom (evidencia gestionada en Classroom).'

export async function ensureClassroomTaskGroupSubmissions(input: {
  institutionId: number
  taskId: number
  groupId: number | null
  trx?: TransactionClientContract
}): Promise<number> {
  if (!input.groupId) return 0

  let studentsQuery = db
    .from('group_students')
    .where('group_id', input.groupId)
    .where('institution_id', input.institutionId)
    .select('student_id')
    .orderBy('student_id', 'asc')

  if (input.trx) studentsQuery = studentsQuery.useTransaction(input.trx)

  const students = await studentsQuery
  if (students.length === 0) return 0

  const baseTime = DateTime.now()
  let created = 0

  for (const [index, row] of students.entries()) {
    const studentId = row.student_id as number

    let existingQuery = db
      .from('submissions')
      .where('task_id', input.taskId)
      .where('student_id', studentId)

    if (input.trx) existingQuery = existingQuery.useTransaction(input.trx)

    const existing = await existingQuery.first()
    if (existing) continue

    let insertQuery = db.table('submissions').insert({
      institution_id: input.institutionId,
      task_id: input.taskId,
      student_id: studentId,
      evidence_text: CLASSROOM_ROSTER_EVIDENCE,
      evidence_url: null,
      status: 'pending',
      submitted_at: baseTime.plus({ seconds: index }).toJSDate(),
      created_at: new Date(),
      updated_at: null,
    })

    if (input.trx) insertQuery = insertQuery.useTransaction(input.trx)

    await insertQuery
    created += 1
  }

  return created
}
