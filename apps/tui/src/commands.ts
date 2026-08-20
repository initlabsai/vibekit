import { classifyExplorerInput, parsePaymentComposerCommand } from '@initlabs/vibekit-experience'

/**
 * The transcript's deterministic lane, checked before any model call: exact
 * commands, then recognized identifiers; everything else is conversation.
 */
export type ComposerRoute =
  | { status: 'payment'; amountMicroAlgos: number }
  | { status: 'transaction'; txid: string }
  | { status: 'account'; address: string }
  | { status: 'nav'; screen: 'accounts' }
  | { status: 'network'; network?: 'localnet' | 'testnet' | 'mainnet' }
  | { status: 'sample' }
  | { status: 'help' }
  | { status: 'ambiguous'; value: string }
  | { status: 'text'; text: string }

/** Routes one composer submission. */
export function routeComposerInput(input: string): ComposerRoute {
  const trimmed = input.trim()
  const payment = parsePaymentComposerCommand(trimmed)
  if (payment) return { status: 'payment', ...payment }
  const word = trimmed.toLowerCase()
  if (word === 'accounts') return { status: 'nav', screen: 'accounts' }
  if (word === 'network') return { status: 'network' }
  const networkMatch = /^network\s+(localnet|testnet|mainnet)$/.exec(word)
  if (networkMatch) {
    return { status: 'network', network: networkMatch[1] as 'localnet' | 'testnet' | 'mainnet' }
  }
  if (word === 'sample') return { status: 'sample' }
  if (word === 'help' || word === '?') return { status: 'help' }
  const classified = classifyExplorerInput(trimmed)
  if (classified.kind === 'entity' && classified.entity === 'transaction') {
    return { status: 'transaction', txid: classified.value }
  }
  if (classified.kind === 'entity' && classified.entity === 'account') {
    return { status: 'account', address: classified.value }
  }
  if (classified.kind === 'ambiguous-entity') {
    return { status: 'ambiguous', value: classified.value }
  }
  return { status: 'text', text: trimmed }
}
