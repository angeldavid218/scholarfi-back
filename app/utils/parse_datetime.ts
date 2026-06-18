import { DateTime } from 'luxon'

export function toIsoDateTime(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null

  if (value instanceof Date) {
    return DateTime.fromJSDate(value).toISO()
  }

  const iso = DateTime.fromISO(String(value))
  if (iso.isValid) return iso.toISO()

  const sql = DateTime.fromSQL(String(value))
  if (sql.isValid) return sql.toISO()

  const js = new Date(String(value))
  if (!Number.isNaN(js.getTime())) {
    return DateTime.fromJSDate(js).toISO()
  }

  return null
}
