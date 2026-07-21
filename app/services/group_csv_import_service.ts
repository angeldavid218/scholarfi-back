import db from '@adonisjs/lucid/services/db'
import {
  csvImportLogDebug,
  csvImportLogInfo,
  csvImportLogWarn,
  type GroupCsvImportLogContext,
} from '#services/group_csv_import_logger'
import {
  type GroupImportColumnMapping,
  parseCsvContentWithMapping,
  validateGroupImportColumnMapping,
  validateGroupImportParsed,
} from '#services/csv_parser_service'
import {
  findInstitutionGroup,
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
  requestId?: string | null
}): Promise<{ runId: number | null; summary: CsvImportSummary }> {
  const logCtx: GroupCsvImportLogContext = {
    requestId: input.requestId,
    institutionId: input.institutionId,
    teacherId: input.teacherId,
    filename: input.filename,
    dryRun: input.dryRun,
  }

  csvImportLogInfo('CSV import started', logCtx, {
    contentLength: input.csvContent.length,
    hasColumnMapping: input.columnMapping != null,
  })

  const { parsed, mapping } = parseCsvContentWithMapping(input.csvContent, input.columnMapping)

  csvImportLogInfo('CSV parsed', logCtx, {
    headerCount: parsed.headers.length,
    rowCount: parsed.rows.length,
    mappedFields: Object.keys(mapping),
  })
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
    csvImportLogWarn('CSV import aborted: invalid column mapping', logCtx, { mappingError })
    summary.errors.push({ row: 0, field: 'columnMapping', message: mappingError })
    return { runId: null, summary }
  }

  const parsedError = validateGroupImportParsed(parsed)
  if (parsedError) {
    csvImportLogWarn('CSV import aborted: invalid file content', logCtx, { parsedError })
    summary.errors.push({ row: 0, field: 'file', message: parsedError })
    return { runId: null, summary }
  }

  const createdSubjectKeys = new Set<string>()
  const createdGroupKeys = new Set<string>()
  const createdStudentEmails = new Set<string>()
  const pendingStudentEmails = new Set<string>()
  const pendingStudentRegistrationNumbers = new Set<string>()

  const processRows = async () => {
    for (let index = 0; index < parsed.rows.length; index++) {
      const rowNumber = index + 2
      const row = parsed.rows[index]
      const studentEmail = row.student_email?.trim() ?? ''
      const subjectName = row.subject?.trim() ?? ''
      const section = row.section?.trim() || null
      const className = row.class_name?.trim() || null
      const registrationNumber = row.registration_number?.trim() || null

      if (!studentEmail) {
        csvImportLogDebug('CSV row skipped: missing student email', logCtx, { row: rowNumber })
        summary.errors.push({ row: rowNumber, field: 'student_email', message: 'Student email is required' })
        summary.rowResults.push({ row: rowNumber, status: 'error', message: 'Student email is required' })
        continue
      }

      if (!subjectName && !className) {
        csvImportLogDebug('CSV row skipped: missing subject and class_name', logCtx, {
          row: rowNumber,
          studentEmail,
        })
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
        registrationNumber,
        dryRun: input.dryRun,
        pendingCreatedEmails: pendingStudentEmails,
        pendingCreatedRegistrationNumbers: pendingStudentRegistrationNumbers,
      })

      if (!studentResult.ok) {
        csvImportLogWarn('CSV row failed: student upsert', logCtx, {
          row: rowNumber,
          studentEmail,
          reason: studentResult.message,
        })
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

      const groupBefore = subjectBefore
        ? await findInstitutionGroup({
            institutionId: input.institutionId,
            subjectId: subjectBefore.id as number,
            subjectName: (subjectBefore.name as string) ?? resolvedSubjectName,
            section,
            className,
          })
        : null

      const groupKey = `${subjectKey}:${section ?? className ?? resolvedSubjectName}`
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

      csvImportLogDebug('CSV row processed', logCtx, {
        row: rowNumber,
        status: groupBefore ? 'updated' : 'created',
        studentEmail,
        subject: resolvedSubjectName,
        section,
        studentCreated: studentResult.created,
        groupId: input.dryRun ? null : (group.id as number),
      })
    }
  }

  await processRows()

  summary.subjectsCreated = createdSubjectKeys.size
  summary.groupsCreated = createdGroupKeys.size
  summary.studentsCreated = createdStudentEmails.size

  if (input.dryRun) {
    csvImportLogInfo('CSV import dry-run completed', logCtx, {
      subjectsCreated: summary.subjectsCreated,
      groupsCreated: summary.groupsCreated,
      studentsCreated: summary.studentsCreated,
      enrollmentsUpserted: summary.enrollmentsUpserted,
      teacherLinksUpserted: summary.teacherLinksUpserted,
      errorCount: summary.errors.length,
    })
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

  csvImportLogInfo('CSV import completed', { ...logCtx, runId }, {
    status: summary.errors.length > 0 ? 'completed_with_errors' : 'completed',
    subjectsCreated: summary.subjectsCreated,
    groupsCreated: summary.groupsCreated,
    studentsCreated: summary.studentsCreated,
    enrollmentsUpserted: summary.enrollmentsUpserted,
    teacherLinksUpserted: summary.teacherLinksUpserted,
    errorCount: summary.errors.length,
    rowCount: parsed.rows.length,
  })

  return { runId, summary }
}
