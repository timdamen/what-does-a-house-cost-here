/** Narrows an unknown JSON value to a plain object (arrays and `null` excluded). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
