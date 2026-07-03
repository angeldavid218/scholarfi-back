import Papa from 'papaparse'

export type ParsedCsv = {
  headers: string[]
  rows: Record<string, string>[]
}

export type GroupImportField =
  | 'student_email'
  | 'student_name'
  | 'subject'
  | 'section'
  | 'class_name'

export type GroupImportColumnMapping = Partial<Record<GroupImportField, string>>

export const GROUP_IMPORT_FIELDS: GroupImportField[] = [
  'student_email',
  'student_name',
  'subject',
  'section',
  'class_name',
]

const FIELD_ALIASES: Record<GroupImportField, string[]> = {
  student_email: [
    'student_email',
    'email',
    'correo',
    'correo_electronico',
    'correo_electrónico',
    'e_mail',
    'mail',
    'email_estudiante',
    'correo_estudiante',
  ],
  student_name: [
    'student_name',
    'nombre',
    'name',
    'nombre_estudiante',
    'nombre_completo',
    'full_name',
    'alumno',
    'estudiante',
  ],
  subject: ['subject', 'materia', 'asignatura', 'disciplina', 'curso_materia'],
  section: ['section', 'grupo', 'seccion', 'sección', 'grupo_seccion', 'paralelo', 'salon', 'salón'],
  class_name: ['class_name', 'curso', 'clase', 'nombre_clase', 'nombre_curso', 'class', 'titulo_clase'],
}

function trimHeader(raw: string): string {
  return raw.trim()
}

function normalizeHeaderKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

function trimRowValues(row: Record<string, unknown>): Record<string, string> {
  const trimmed: Record<string, string> = {}
  for (const [key, value] of Object.entries(row)) {
    trimmed[key] = String(value ?? '').trim()
  }
  return trimmed
}

export function parseCsvContentRaw(content: string): ParsedCsv {
  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: trimHeader,
  })

  const headers = result.meta.fields ?? []
  const rows = result.data.map(trimRowValues)

  return { headers, rows }
}

export function suggestGroupImportColumnMapping(headers: string[]): GroupImportColumnMapping {
  const mapping: GroupImportColumnMapping = {}
  const usedHeaders = new Set<string>()

  for (const field of GROUP_IMPORT_FIELDS) {
    for (const header of headers) {
      if (usedHeaders.has(header)) continue
      const normalized = normalizeHeaderKey(header)
      if (FIELD_ALIASES[field].includes(normalized)) {
        mapping[field] = header
        usedHeaders.add(header)
        break
      }
    }
  }

  return mapping
}

export function applyGroupImportColumnMapping(
  parsed: ParsedCsv,
  mapping: GroupImportColumnMapping
): ParsedCsv {
  const activeFields = GROUP_IMPORT_FIELDS.filter((field) => mapping[field])
  const rows = parsed.rows.map((row) => {
    const mapped: Record<string, string> = {}
    for (const field of activeFields) {
      const csvColumn = mapping[field]!
      mapped[field] = row[csvColumn]?.trim() ?? ''
    }
    return mapped
  })

  return { headers: activeFields, rows }
}

export function validateGroupImportColumnMapping(mapping: GroupImportColumnMapping): string | null {
  if (!mapping.student_email) {
    return 'Debes asignar la columna de correo del estudiante'
  }

  if (!mapping.subject && !mapping.class_name) {
    return 'Debes asignar la columna de materia o de nombre de clase'
  }

  const assignedColumns = GROUP_IMPORT_FIELDS.map((field) => mapping[field]).filter(Boolean) as string[]
  const duplicates = assignedColumns.filter((column, index) => assignedColumns.indexOf(column) !== index)
  if (duplicates.length > 0) {
    return `No puedes usar la misma columna para varios campos: ${[...new Set(duplicates)].join(', ')}`
  }

  return null
}

export function validateGroupImportParsed(parsed: ParsedCsv): string | null {
  if (parsed.rows.length === 0) {
    return 'El archivo CSV está vacío o no tiene filas de datos'
  }

  if (!parsed.headers.includes('student_email')) {
    return 'Falta la columna requerida: student_email'
  }

  if (!parsed.headers.includes('subject') && !parsed.headers.includes('class_name')) {
    return 'Falta la columna requerida: subject o class_name'
  }

  return null
}

export function parseCsvContentWithMapping(
  content: string,
  mapping?: GroupImportColumnMapping
): { parsed: ParsedCsv; mapping: GroupImportColumnMapping } {
  const raw = parseCsvContentRaw(content)
  const effectiveMapping = mapping ?? suggestGroupImportColumnMapping(raw.headers)
  const mappingError = validateGroupImportColumnMapping(effectiveMapping)
  if (mappingError) {
    return {
      parsed: { headers: [], rows: [] },
      mapping: effectiveMapping,
    }
  }

  const parsed = applyGroupImportColumnMapping(raw, effectiveMapping)
  return { parsed, mapping: effectiveMapping }
}

/** @deprecated Use parseCsvContentWithMapping for imports with optional column mapping. */
export function parseCsvContent(content: string): ParsedCsv {
  return parseCsvContentWithMapping(content).parsed
}
