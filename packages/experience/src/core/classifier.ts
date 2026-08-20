import { z } from 'zod'

const TRANSACTION_ID_PATTERN = /^[A-Z2-7]{51}[AQ]$/
const ADDRESS_PATTERN = /^[A-Z2-7]{57}[AEIMQUY4]$/
const NUMERIC_ID_PATTERN = /^(0|[1-9]\d*)$/
/** 32-byte group digest as RFC 4648 base64 (44 chars, one trailing pad). */
const GROUP_ID_PATTERN = /^[A-Za-z0-9+/]{43}=$/
const GROUP_ID_URLSAFE_PATTERN = /^[A-Za-z0-9_-]{43}=$/

/** Canonical unpadded base32 shape of a 32-byte Algorand transaction hash. */
export const algorandTransactionIdSchema = z
  .string()
  .regex(TRANSACTION_ID_PATTERN, 'Expected a canonical 52-character Algorand transaction ID')

/**
 * Structural Algorand address shape. Full checksum validation belongs at the
 * lookup boundary; keeping the classifier dependency-free preserves browser use.
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

/** Result of deterministic Explorer input classification. */
export type ClassifiedExplorerInput =
  | {
      kind: 'entity'
      entity: 'transaction'
      value: string
    }
  | {
      kind: 'entity'
      entity: 'account'
      value: string
    }
  | {
      kind: 'entity'
      entity: 'group'
      value: string
    }
  | {
      kind: 'ambiguous-entity'
      value: string
      candidates: readonly ['asset', 'application', 'block']
    }
  | {
      kind: 'text'
      value: string
    }

/**
 * Classifies direct Explorer input without an LLM or network call. Bare
 * numeric identifiers stay an explicit asset/application/block ambiguity
 * instead of guessing which domain owns the number.
 */
export function classifyExplorerInput(raw: string): ClassifiedExplorerInput {
  const input = raw.trim()
  if (algorandTransactionIdSchema.safeParse(input).success) {
    return { kind: 'entity', entity: 'transaction', value: input }
  }
  if (algorandAddressCandidateSchema.safeParse(input).success) {
    return { kind: 'entity', entity: 'account', value: input }
  }
  if (algorandGroupIdSchema.safeParse(input).success) {
    return { kind: 'entity', entity: 'group', value: input }
  }
  if (NUMERIC_ID_PATTERN.test(input)) {
    return {
      kind: 'ambiguous-entity',
      value: input,
      candidates: ['asset', 'application', 'block'],
    }
  }
  return { kind: 'text', value: input }
}

/** A composer command that names one entity kind and a numeric id. */
export type DirectedEntityCommand =
  | { entity: 'asset'; id: number }
  | { entity: 'application'; id: number }
  | { entity: 'block'; id: number }
  | { entity: 'group'; id: string }

/**
 * Parses `asset 1042`, `app 1071`, `application 1071`, `asa 1042`,
 * `block 22`, or `group <base64>`. Bare numbers stay ambiguous and go
 * through classifyExplorerInput.
 */
export function parseEntityComposerCommand(raw: string): DirectedEntityCommand | undefined {
  const trimmed = raw.trim()
  const groupMatch = /^group\s+(\S+)$/i.exec(trimmed)
  if (groupMatch) {
    const id = groupMatch[1]!
    if (!algorandGroupIdSchema.safeParse(id).success) return undefined
    return { entity: 'group', id }
  }
  const match = /^(asset|asa|app|application|block)\s+(0|[1-9]\d*)$/i.exec(trimmed)
  if (!match) return undefined
  const id = Number(match[2])
  if (!Number.isSafeInteger(id)) return undefined
  const kind = match[1]!.toLowerCase()
  if (kind === 'asset' || kind === 'asa') return { entity: 'asset', id }
  if (kind === 'app' || kind === 'application') return { entity: 'application', id }
  return { entity: 'block', id }
}
