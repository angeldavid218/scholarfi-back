import db from '@adonisjs/lucid/services/db'
import { parseCsvContent } from '#services/csv_parser_service'
import {
  findInstitutionStudentByEmail,
  findOrCreateGroup,
  findOrCreateSubject,
  upsertGroupStudent,
  upsertGroupTeacher,
} from '#services/group_upsert_service'

export type CsvImportRowError = {
  row: number
  field: string
  message: string
}

export type CsvImportRowResult = {
  row: number
  status: 'created' | 'updated' | 'skipped' | 'error'
  studentEmail?: string
  subject?: string
  section?: string | null
  message?: string
}

export type CsvImportSummary = {
  dryRun: boolean
  subjectsCreated: number
  groupsCreated: number
  enrollmentsUpserted: number
  teacherLinksUpserted: number
  rowResults: CsvImportRowResult[]
  errors: CsvImportRowError[]
}

export async function importGroupsFromCsv(input: {
  institutionId: number
  teacherId: number
  filename: string
  csvContent: string
  dryRun: boolean
}): Promise<{ runId: number | null; summary: CsvImportSummary }> {
  const parsed = parseCsvContent(input.csvContent)
  const summary: CsvImportSummary = {
    dryRun: input.dryRun,
    subjectsCreated: 0,
    groupsCreated: 0,
    enrollmentsUpserted: 0,
    teacherLinksUpserted: 0,
    rowResults: [],
    errors: [],
  }

  if (parsed.rows.length === 0) {
    summary.errors.push({ row: 0, field: 'file', message: 'CSV file is empty or has no data rows' })
    return { runId: null, summary }
  }

  const requiredHeaders = ['student_email', 'subject']
  for (const header of requiredHeaders) {
    if (!parsed.headers.includes(header)) {
      summary.errors.push({
        row: 0,
        field: 'header',
        message: `Missing required column: ${header}`,
      })
      return { runId: null, summary }
    }
  }

  const createdSubjectKeys = new Set<string>()
  const createdGroupKeys = new Set<string>()

  const processRows = async () => {
    for (let index = 0; index < parsed.rows.length; index++) {
      const rowNumber = index + 2
      const row = parsed.rows[index]
      const studentEmail = row.student_email?.trim() ?? ''
      const subjectName = row.subject?.trim() ?? ''
      const section = row.section?.trim() || null
      const className = row.class_name?.trim() || null

      if (!studentEmail) {
        summary.errors.push({ row: rowNumber, field: 'student_email', message: 'Student email is required' })
        summary.rowResults.push({ row: rowNumber, status: 'error', message: 'Student email is required' })
        continue
      }

      if (!subjectName && !className) {
        summary.errors.push({
          row: rowNumber,
          field: 'subject',
          message: 'Subject or class_name is required',
        })
        summary.rowResults.push({ row: rowNumber, status: 'error', message: 'Subject or class_name is required' })
        continue
      }

      const resolvedSubjectName = subjectName || className || 'General'
      const student = await findInstitutionStudentByEmail(input.institutionId, studentEmail)
      if (!student) {
        summary.errors.push({
          row: rowNumber,
          field: 'student_email',
          message: `Student not found in institution: ${studentEmail}`,
        })
        summary.rowResults.push({
          row: rowNumber,
          status: 'error',
          studentEmail,
          subject: resolvedSubjectName,
          section,
          message: `Student not found: ${studentEmail}`,
        })
        continue
      }

      const subjectBefore = await db
        .from('subjects')
        .where('institution_id', input.institutionId)
        .whereILike('name', resolvedSubjectName.trim())
        .first()

      const subjectKey = resolvedSubjectName.trim().toLowerCase()
      if (!subjectBefore) createdSubjectKeys.add(subjectKey)

      const subject = input.dryRun
        ? subjectBefore ?? {
            id: 0,
            name: resolvedSubjectName.trim(),
          }
        : await findOrCreateSubject(input.institutionId, resolvedSubjectName)

      const groupLookupSection = section
      const groupBefore = subjectBefore
        ? groupLookupSection
          ? await db
              .from('groups')
              .where('institution_id', input.institutionId)
              .where('subject_id', subjectBefore.id)
              .where('section', groupLookupSection)
              .first()
          : await db
              .from('groups')
              .where('institution_id', input.institutionId)
              .where('subject_id', subjectBefore.id)
              .where('name', className ?? resolvedSubjectName)
              .first()
        : null

      const groupKey = `${subjectKey}:${groupLookupSection ?? className ?? resolvedSubjectName}`
      if (!groupBefore) createdGroupKeys.add(groupKey)

      const group = input.dryRun
        ? groupBefore ?? { id: 0, name: className ?? resolvedSubjectName }
        : await findOrCreateGroup({
            institutionId: input.institutionId,
            subjectId: subject.id as number,
            subjectName: (subject.name as string) ?? resolvedSubjectName,
            section,
            className,
            externalSource: 'csv_import',
            createdByTeacherId: input.teacherId,
          })

      if (!input.dryRun) {
        await upsertGroupTeacher({
          institutionId: input.institutionId,
          groupId: group.id as number,
          teacherId: input.teacherId,
        })
      }
      summary.teacherLinksUpserted++

      if (!input.dryRun) {
        await upsertGroupStudent({
          institutionId: input.institutionId,
          groupId: group.id as number,
          studentId: student.id as number,
        })
      }
      summary.enrollmentsUpserted++

      summary.rowResults.push({
        row: rowNumber,
        status: groupBefore ? 'updated' : 'created',
        studentEmail,
        subject: (subject.name as string) ?? resolvedSubjectName,
        section,
      })
    }
  }

  await processRows()

  summary.subjectsCreated = createdSubjectKeys.size
  summary.groupsCreated = createdGroupKeys.size

  if (input.dryRun) {
    return { runId: null, summary }
  }

  const inserted = await db
    .table('group_import_runs')
    .insert({
      institution_id: input.institutionId,
      uploaded_by_teacher_id: input.teacherId,
      filename: input.filename,
      status: summary.errors.length > 0 ? 'completed_with_errors' : 'completed',
      summary_json: summary,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')

  const runRow = inserted[0] as { id: number } | number
  const runId = typeof runRow === 'number' ? runRow : runRow.id

  return { runId, summary }
}
