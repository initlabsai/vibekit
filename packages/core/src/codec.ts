/**
 * The one place chain data becomes JSON-safe. algosdk v3 emits `bigint` and
 * `Uint8Array` throughout; hosts apply this codec in their adapter so handlers
 * can return raw algosdk values freely. Browser-safe (no Buffer requirement).
 */

/** Uint8Array → base64, in any runtime. */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** base64 → Uint8Array, in any runtime. */
export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Deep-convert a handler result to JSON-safe data:
 * bigint → number when within Number.MAX_SAFE_INTEGER, else decimal string;
 * Uint8Array → base64; `undefined` object entries dropped.
 */
export function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(-Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value.toString()
  }
  if (value instanceof Uint8Array) {
    return bytesToBase64(value)
  }
  if (Array.isArray(value)) {
    return value.map(jsonSafe)
  }
  if (value instanceof Map) {
    return jsonSafe(Object.fromEntries(value))
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) out[key] = jsonSafe(entry)
    }
    return out
  }
  return value
}
