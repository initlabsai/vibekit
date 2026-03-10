/**
 * Validate and parse a metadata hash.
 * Accepts 64 hex characters or 44 base64 characters (both = 32 bytes).
 * @returns Uint8Array of 32 bytes, or undefined if not provided
 * @throws Error if hash is invalid
 */
export function validateMetadataHash(hash: string | undefined): Uint8Array | undefined {
  if (!hash) {
    return undefined
  }

  let bytes: Uint8Array

  if (hash.length === 64) {
    // Hex encoded
    const matches = hash.match(/.{2}/g)
    if (!matches) {
      throw new Error('metadataHash must be 64 hex characters or 44 base64 characters (32 bytes)')
    }
    bytes = new Uint8Array(matches.map((byte) => parseInt(byte, 16)))
  } else if (hash.length === 44) {
    // Base64 encoded
    bytes = Uint8Array.from(atob(hash), (c) => c.charCodeAt(0))
  } else {
    throw new Error('metadataHash must be 64 hex characters or 44 base64 characters (32 bytes)')
  }

  if (bytes.length !== 32) {
    throw new Error('metadataHash must decode to exactly 32 bytes')
  }

  return bytes
}
