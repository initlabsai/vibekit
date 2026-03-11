/**
 * Centralized Validation Module
 *
 * Reusable validators for tool arguments across domain packages.
 */

// ============================================================================
// Address Validation
// ============================================================================

export function validateRequiredAddress(
  address: string | undefined,
  fieldName: string
): asserts address is string {
  if (!address) {
    throw new Error(`${fieldName} is required`)
  }
  if (address.length !== 58) {
    throw new Error(`Invalid ${fieldName}: must be 58 characters`)
  }
}

export function validateOptionalAddress(
  address: string | undefined,
  fieldName: string,
  allowEmpty = false
): void {
  if (address === undefined) {
    return
  }
  if (allowEmpty && address === '') {
    return
  }
  if (address.length !== 58) {
    const message = allowEmpty
      ? `Invalid ${fieldName}: must be 58 characters or empty string`
      : `Invalid ${fieldName}: must be 58 characters`
    throw new Error(message)
  }
}

// ============================================================================
// Numeric Validation
// ============================================================================

export function validateRequiredId(
  value: number | undefined,
  fieldName: string
): asserts value is number {
  if (value === undefined || value === null) {
    throw new Error(`${fieldName} is required`)
  }
  if (value < 0) {
    throw new Error(`${fieldName} must be non-negative`)
  }
}

export function validateRequiredAmount(
  value: number | undefined,
  fieldName = 'amount'
): asserts value is number {
  if (value === undefined || value === null) {
    throw new Error(`${fieldName} is required`)
  }
  if (value < 0) {
    throw new Error(`${fieldName} must be non-negative`)
  }
}

export function validateRequiredPositiveAmount(
  value: number | undefined,
  fieldName = 'amount'
): asserts value is number {
  if (value === undefined || value === null) {
    throw new Error(`${fieldName} is required`)
  }
  if (value < 1) {
    throw new Error(`${fieldName} must be at least 1`)
  }
}

export function validateDecimals(decimals: number): void {
  if (decimals < 0 || decimals > 19) {
    throw new Error('decimals must be between 0 and 19')
  }
}

// ============================================================================
// Byte Length Validation
// ============================================================================

export function validateByteLength(
  value: string | undefined,
  fieldName: string,
  maxBytes: number
): void {
  if (value && new TextEncoder().encode(value).length > maxBytes) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxBytes} bytes`)
  }
}

export function validateNote(note: string | undefined): void {
  validateByteLength(note, 'note', 1000)
}

export function validateAssetName(name: string | undefined): void {
  validateByteLength(name, 'assetName', 32)
}

export function validateUnitName(name: string | undefined): void {
  validateByteLength(name, 'unitName', 8)
}

export function validateAssetUrl(url: string | undefined): void {
  validateByteLength(url, 'url', 96)
}

// ============================================================================
// Specialized Validation
// ============================================================================

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

export function validateRequiredBoolean(
  value: boolean | undefined,
  fieldName: string
): asserts value is boolean {
  if (value === undefined || value === null) {
    throw new Error(`${fieldName} is required`)
  }
}
