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

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  values.push(current.trim())
  return values
}

export function parseCsvContent(content: string): ParsedCsv {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const rawHeaders = parseCsvLine(lines[0])
  const headers = rawHeaders.map(normalizeHeader)
  const rows: Record<string, string>[] = []

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
    const values = parseCsvLine(lines[lineIndex])
    const row: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = (values[i] ?? '').trim()
    }
    rows.push(row)
  }

  return { headers, rows }
}
