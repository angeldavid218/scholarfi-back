export function parsePositiveInt(input: unknown, fallback: number): number {
  const parsed = Number(input)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return parsed
}
