/** Wire-shape schemas the action records share: JSON-safe uint64s and Algorand id shapes. */
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

/** Compares two JSON-safe uint64 values by numeric identity. */
export function sameUint64(left: Uint64Json, right: Uint64Json): boolean {
  return BigInt(left) === BigInt(right)
}

const TRANSACTION_ID_PATTERN = /^[A-Z2-7]{51}[AQ]$/
const ADDRESS_PATTERN = /^[A-Z2-7]{57}[AEIMQUY4]$/
/** 32-byte group digest as RFC 4648 base64 (44 chars, one trailing pad). */
const GROUP_ID_PATTERN = /^[A-Za-z0-9+/]{43}=$/
const GROUP_ID_URLSAFE_PATTERN = /^[A-Za-z0-9_-]{43}=$/

/** Canonical unpadded base32 shape of a 32-byte Algorand transaction hash. */
export const algorandTransactionIdSchema = z
  .string()
  .regex(TRANSACTION_ID_PATTERN, 'Expected a canonical 52-character Algorand transaction ID')

/**
 * Structural Algorand address shape. Full checksum validation belongs at the
 * lookup boundary; keeping this dependency-free preserves browser use.
 */
export const algorandAddressCandidateSchema = z
  .string()
  .regex(ADDRESS_PATTERN, 'Expected a 58-character Algorand address candidate')

/** Structural group-id shape as returned by lookup_transaction (`group` is base64). */
export const algorandGroupIdSchema = z
  .string()
  .refine(
    (value) => GROUP_ID_PATTERN.test(value) || GROUP_ID_URLSAFE_PATTERN.test(value),
    'Expected a 44-character base64 Algorand group ID',
  )
