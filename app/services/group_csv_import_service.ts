import db from '@adonisjs/lucid/services/db'
import {
  type GroupImportColumnMapping,
  parseCsvContentWithMapping,
  validateGroupImportColumnMapping,
  validateGroupImportParsed,
} from '#services/csv_parser_service'
import {
  findOrCreateGroup,
  findOrCreateInstitutionStudent,
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
  studentsCreated: number
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
  columnMapping?: GroupImportColumnMapping
}): Promise<{ runId: number | null; summary: CsvImportSummary }> {
  const { parsed, mapping } = parseCsvContentWithMapping(input.csvContent, input.columnMapping)
  const summary: CsvImportSummary = {
    dryRun: input.dryRun,
    subjectsCreated: 0,
    groupsCreated: 0,
    studentsCreated: 0,
    enrollmentsUpserted: 0,
    teacherLinksUpserted: 0,
    rowResults: [],
    errors: [],
  }

  const mappingError = validateGroupImportColumnMapping(mapping)
  if (mappingError) {
    summary.errors.push({ row: 0, field: 'columnMapping', message: mappingError })
    return { runId: null, summary }
  }

  const parsedError = validateGroupImportParsed(parsed)
  if (parsedError) {
    summary.errors.push({ row: 0, field: 'file', message: parsedError })
    return { runId: null, summary }
  }

  const createdSubjectKeys = new Set<string>()
  const createdGroupKeys = new Set<string>()
  const createdStudentEmails = new Set<string>()
  const pendingStudentEmails = new Set<string>()

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
      const studentName = row.student_name?.trim() || null
      const studentResult = await findOrCreateInstitutionStudent({
        institutionId: input.institutionId,
        email: studentEmail,
        fullName: studentName,
        dryRun: input.dryRun,
        pendingCreatedEmails: pendingStudentEmails,
      })

      if (!studentResult.ok) {
        summary.errors.push({
          row: rowNumber,
          field: 'student_email',
          message: studentResult.message,
        })
        summary.rowResults.push({
          row: rowNumber,
          status: 'error',
          studentEmail,
          subject: resolvedSubjectName,
          section,
          message: studentResult.message,
        })
        continue
      }

      const student = studentResult.student
      if (studentResult.created) {
        createdStudentEmails.add(studentEmail.trim().toLowerCase())
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
  summary.studentsCreated = createdStudentEmails.size

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
