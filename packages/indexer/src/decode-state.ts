/**
 * Decode Algorand application state values from base64.
 *
 * Follows the same heuristics as algokit-lora:
 * - 32-byte values → Algorand address (base32 with checksum)
 * - Printable text (no control chars) → UTF-8 string
 * - ≤8 bytes with control chars → big-endian uint64
 * - Everything else → original base64
 */

import algosdk from 'algosdk'

export type DecodedValue =
  | { type: 'string'; display: string }
  | { type: 'uint'; display: string }
  | { type: 'address'; display: string; full: string }
  | { type: 'bytes'; display: string }

export function decodeStateValue(base64: string): DecodedValue {
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

    // 32 bytes → likely an Algorand address
    if (bytes.length === 32) {
      const addr = algosdk.encodeAddress(bytes)
      return { type: 'address', display: addr.slice(0, 6) + '...' + addr.slice(-4), full: addr }
    }

    // Try as printable text (no control characters including null)
    const text = new TextDecoder().decode(bytes)
    if (text.length > 0 && !/[\x00-\x1F\x7F]/.test(text)) {
      return { type: 'string', display: text }
    }

    // Small byte arrays → interpret as big-endian uint64
    if (bytes.length <= 8) {
      let value = 0n
      for (const byte of bytes) value = (value << 8n) | BigInt(byte)
      return { type: 'uint', display: value.toString() }
    }

    return { type: 'bytes', display: base64 }
  } catch {
    return { type: 'bytes', display: base64 }
  }
}

