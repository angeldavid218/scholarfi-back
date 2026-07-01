import Papa from 'papaparse'

export type ParsedCsv = {
  headers: string[]
  rows: Record<string, string>[]
}

const HEADER_ALIASES: Record<string, string> = {
  student_email: 'student_email',
  email: 'student_email',
  correo: 'student_email',
  student_name: 'student_name',
  nombre: 'student_name',
  name: 'student_name',
  subject: 'subject',
  materia: 'subject',
  section: 'section',
  grupo: 'section',
  seccion: 'section',
  class_name: 'class_name',
  curso: 'class_name',
  clase: 'class_name',
}

function normalizeHeader(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_')
  return HEADER_ALIASES[key] ?? key
}

function trimRowValues(row: Record<string, unknown>): Record<string, string> {
  const trimmed: Record<string, string> = {}
  for (const [key, value] of Object.entries(row)) {
    trimmed[key] = String(value ?? '').trim()
  }
  return trimmed
}

export function parseCsvContent(content: string): ParsedCsv {
  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  })

  const headers = result.meta.fields ?? []
  const rows = result.data.map(trimRowValues)

  return { headers, rows }
}
