import { z } from 'zod'

import { parseAlgosToMicroAlgos } from './format.js'

import {
  algorandAddressCandidateSchema,
  algorandGroupIdSchema,
  algorandTransactionIdSchema,
} from '../actions/index.js'

export { algorandAddressCandidateSchema, algorandGroupIdSchema, algorandTransactionIdSchema }

const NUMERIC_ID_PATTERN = /^(0|[1-9]\d*)$/
/**
 * NFD-shaped account name: lowercase [a-z0-9-] segments ending in `.algo`
 * (alice.algo, sub.name.algo). Cannot collide with the base32 shapes above —
 * those never contain a dot — so order only matters against the text fallback.
 */
const ACCOUNT_NAME_PATTERN = /^(?:[a-z0-9-]+\.)+algo$/

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
      kind: 'entity'
      entity: 'account-name'
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
  if (ACCOUNT_NAME_PATTERN.test(input)) {
    return { kind: 'entity', entity: 'account-name', value: input }
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

/** The amount a bare `pay` drafts; the same figure as the fixture payment. */
const DEFAULT_PAYMENT_MICROALGOS = 250_000

/**
 * Parses the deterministic composer command that begins a payment: `pay`,
 * `draft payment`, or `pay <algos>` with up to six decimal places, optionally
 * `to <label | address>`; hosts resolve the receiver.
 */
export function parsePaymentComposerCommand(
  raw: string,
): { amountMicroAlgos: number; to?: string } | undefined {
  const input = raw.trim()
  if (/^(pay|draft payment)$/i.test(input)) {
    return { amountMicroAlgos: DEFAULT_PAYMENT_MICROALGOS }
  }
  const withAmount = /^pay\s+(\S+)(?:\s+to\s+(\S+))?$/i.exec(input)
  if (!withAmount) return undefined
  const amountMicroAlgos = parseAlgosToMicroAlgos(withAmount[1]!)
  if (amountMicroAlgos === undefined || amountMicroAlgos <= 0) return undefined
  return withAmount[2] ? { amountMicroAlgos, to: withAmount[2] } : { amountMicroAlgos }
}

/**
 * The deterministic composer lane both Explorer apps share: a typed payment,
 * a directed entity command, then a recognized identifier; anything else is
 * text. Navigation, help, and network commands are the app's own words and
 * are matched before this.
 */
export type ExplorerComposerRoute =
  | { status: 'payment'; amountMicroAlgos: number; to?: string }
  | { status: 'transaction'; txid: string }
  | { status: 'group'; groupId: string }
  | { status: 'account'; address: string }
  | { status: 'account-name'; name: string }
  | { status: 'asset'; assetId: number }
  | { status: 'application'; applicationId: number }
  | { status: 'block'; round: number }
  | { status: 'ambiguous'; value: string }
  | { status: 'text'; text: string }

export function routeExplorerComposerInput(input: string): ExplorerComposerRoute {
  const trimmed = input.trim()
  const payment = parsePaymentComposerCommand(trimmed)
  if (payment) return { status: 'payment', ...payment }
  const directed = parseEntityComposerCommand(trimmed)
  if (directed?.entity === 'asset') return { status: 'asset', assetId: directed.id }
  if (directed?.entity === 'application')
    return { status: 'application', applicationId: directed.id }
  if (directed?.entity === 'block') return { status: 'block', round: directed.id }
  if (directed?.entity === 'group') return { status: 'group', groupId: directed.id }
  const classified = classifyExplorerInput(trimmed)
  if (classified.kind === 'entity' && classified.entity === 'transaction') {
    return { status: 'transaction', txid: classified.value }
  }
  if (classified.kind === 'entity' && classified.entity === 'account') {
    return { status: 'account', address: classified.value }
  }
  if (classified.kind === 'entity' && classified.entity === 'account-name') {
    return { status: 'account-name', name: classified.value }
  }
  if (classified.kind === 'entity' && classified.entity === 'group') {
    return { status: 'group', groupId: classified.value }
  }
  if (classified.kind === 'ambiguous-entity') {
    return { status: 'ambiguous', value: classified.value }
  }
  return { status: 'text', text: trimmed }
}
