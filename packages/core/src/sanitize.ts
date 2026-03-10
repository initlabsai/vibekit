/** Recursively convert all BigInt values to strings for JSON serialization. */
export function sanitizeBigInts(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(sanitizeBigInts)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeBigInts(v)])
    )
  }
  return value
}
