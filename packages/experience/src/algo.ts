import { z } from 'zod'

/**
 * A uint64 on the JSON-safe wire: a safe nonnegative integer, or a decimal
 * string when the value exceeds Number.MAX_SAFE_INTEGER (the jsonSafe codec
 * convention).
 */
export const uint64JsonSchema = z.union([
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  z.string().regex(/^\d+$/, 'Expected a decimal uint64 string'),
])

/** A signed microALGO delta on the JSON-safe wire: safe integer or decimal string. */
export const signedMicroAlgosJsonSchema = z.union([
  z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  z.string().regex(/^-?\d+$/, 'Expected a signed decimal string'),
])

/** A uint64 on the JSON-safe wire. */
export type Uint64Json = z.infer<typeof uint64JsonSchema>

/** A signed microALGO amount on the JSON-safe wire. */
export type SignedMicroAlgosJson = z.infer<typeof signedMicroAlgosJsonSchema>

/**
 * Formats microALGOs as an exact decimal ALGO string using digit math, never
 * floating point, so authoritative amounts survive display unchanged.
 */
export function formatMicroAlgos(value: Uint64Json | SignedMicroAlgosJson): string {
  const raw = typeof value === 'number' ? value.toString() : value
  if (!/^-?\d+$/.test(raw)) throw new Error(`Not a microALGO integer: ${raw}`)
  const negative = raw.startsWith('-')
  const digits = (negative ? raw.slice(1) : raw).padStart(7, '0')
  const whole = digits.slice(0, -6).replace(/^0+(?=\d)/, '')
  const fraction = digits.slice(-6).replace(/0+$/, '')
  const magnitude = fraction ? `${whole}.${fraction}` : whole
  return negative && magnitude !== '0' ? `-${magnitude}` : magnitude
}

/**
 * Parses a human decimal ALGO amount into safe-integer microALGOs using digit
 * math. Returns undefined for malformed input, more than six decimal places,
 * or amounts beyond the safe-integer range.
 */
export function parseAlgosToMicroAlgos(text: string): number | undefined {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text.trim())
  if (!match) return undefined
  const whole = match[1]!
  const fraction = (match[2] ?? '').padEnd(6, '0')
  const combined = `${whole}${fraction}`.replace(/^0+(?=\d)/, '')
  const value = Number(combined)
  if (!Number.isSafeInteger(value)) return undefined
  return value
}

/** Compares two JSON-safe uint64 values by numeric identity. */
export function sameUint64(left: Uint64Json, right: Uint64Json): boolean {
  return BigInt(left) === BigInt(right)
}
