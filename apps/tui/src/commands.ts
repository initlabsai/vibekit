import {
  classifyExplorerInput,
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  parseEntityComposerCommand,
  parsePaymentComposerCommand,
} from '@initlabs/vibekit-experience'

/**
 * The transcript's deterministic lane, checked before any model call: exact
 * commands, then recognized identifiers; everything else is conversation.
 */
export type ComposerRoute =
  | { status: 'payment'; amountMicroAlgos: number }
  | { status: 'transaction'; txid: string }
  | { status: 'group'; groupId: string }
  | { status: 'account'; address: string }
  | { status: 'asset'; assetId: number }
  | { status: 'application'; applicationId: number }
  | { status: 'block'; round: number }
  | { status: 'nav'; screen: 'wallet' | 'assets' | 'apps' | 'txns' }
  | { status: 'account-list' }
  | { status: 'network'; network?: 'localnet' | 'testnet' | 'mainnet' }
  | { status: 'sample' }
  | { status: 'help' }
  | { status: 'ambiguous'; value: string }
  | { status: 'text'; text: string }

/** Sender and receiver filled in by the host before a typed `pay`. */
export function paymentParties(
  accounts: ReadonlyArray<{ address: string }>,
  activeSender: string | undefined,
): { sender: string; receiver: string } {
  const known = accounts.some((account) => account.address === activeSender)
  const sender = known && activeSender ? activeSender : (accounts[0]?.address ?? FIXTURE_SENDER)
  const receiver =
    accounts.find((account) => account.address !== sender)?.address ?? FIXTURE_RECEIVER
  return { sender, receiver }
}

/** Natural-language "show me my accounts" — not the wallet picker (`accounts`). */
function isAccountListQuery(word: string): boolean {
  return isMineQuery(word, 'accounts')
}

function isMineQuery(word: string, noun: string): boolean {
  const stripped = word.replace(/[?.!]+$/g, '').trim()
  const alt = noun === 'apps' ? 'applications' : noun === 'txns' ? 'transactions' : noun
  const names = noun === alt ? noun : `${noun}|${alt}`
  return (
    stripped === noun ||
    stripped === alt ||
    stripped === `my ${noun}` ||
    stripped === `my ${alt}` ||
    new RegExp(`^(show|list|see)(\\s+me)?(\\s+(my|the))?\\s+(${names})$`).test(stripped)
  )
}

/** Routes one composer submission. */
export function routeComposerInput(input: string): ComposerRoute {
  const trimmed = input.trim()
  const payment = parsePaymentComposerCommand(trimmed)
  if (payment) return { status: 'payment', ...payment }
  const directed = parseEntityComposerCommand(trimmed)
  if (directed?.entity === 'asset') return { status: 'asset', assetId: directed.id }
  if (directed?.entity === 'application') return { status: 'application', applicationId: directed.id }
  if (directed?.entity === 'block') return { status: 'block', round: directed.id }
  if (directed?.entity === 'group') return { status: 'group', groupId: directed.id }
  const word = trimmed.toLowerCase()
  if (word === 'accounts' || word === 'wallet') return { status: 'nav', screen: 'wallet' }
  if (isMineQuery(word, 'assets')) return { status: 'nav', screen: 'assets' }
  if (isMineQuery(word, 'apps')) return { status: 'nav', screen: 'apps' }
  if (isMineQuery(word, 'txns')) return { status: 'nav', screen: 'txns' }
  if (isAccountListQuery(word)) return { status: 'account-list' }
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
  if (classified.kind === 'entity' && classified.entity === 'group') {
    return { status: 'group', groupId: classified.value }
  }
  if (classified.kind === 'ambiguous-entity') {
    return { status: 'ambiguous', value: classified.value }
  }
  return { status: 'text', text: trimmed }
}
