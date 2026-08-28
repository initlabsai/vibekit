import algosdk from 'algosdk'
import {
  FIXTURE_SENDER,
  routeExplorerComposerInput,
  type ExplorerComposerRoute,
} from '@initlabs/vibekit-explorer'

/**
 * The transcript's deterministic lane, checked before any model call: exact
 * commands, then recognized identifiers; everything else is conversation.
 */
export type ComposerRoute =
  | ExplorerComposerRoute
  | { status: 'nav'; screen: 'wallet' | 'assets' | 'apps' | 'txns' | 'blocks' }
  | { status: 'account-list' }
  | { status: 'network'; network?: 'localnet' | 'testnet' | 'mainnet' }
  | { status: 'help' }

/**
 * Parties for a typed `pay`: the sender is the wallet's active account (the
 * one thing the host fills in); the receiver must be named — a keystore
 * label or an address. Nothing is invented.
 */
export function resolvePaymentParties(
  accounts: ReadonlyArray<{ address: string; name?: string }>,
  activeSender: string | undefined,
  to: string | undefined,
): { sender: string; receiver: string } | { error: string } {
  const known = accounts.some((account) => account.address === activeSender)
  const sender = known && activeSender ? activeSender : (accounts[0]?.address ?? FIXTURE_SENDER)
  if (!to) return { error: 'Name the receiver: pay <amount> to <keystore label | address>' }
  if (algosdk.isValidAddress(to)) return { sender, receiver: to }
  const matches = accounts.filter((account) => account.name?.toLowerCase() === to.toLowerCase())
  if (matches.length === 1) return { sender, receiver: matches[0]!.address }
  if (matches.length > 1)
    return { error: `"${to}" matches ${matches.length} accounts — use an address` }
  return { error: `No keystore account named "${to}" — use a label from the wallet or an address` }
}

function isMineQuery(word: string, noun: string): boolean {
  const stripped = word.replace(/[?.!]+$/g, '').trim()
  const alt =
    noun === 'apps'
      ? 'applications'
      : noun === 'txns'
        ? 'transactions'
        : noun === 'accounts'
          ? 'wallets'
          : noun
  const names = noun === alt ? noun : `${noun}|${alt}`
  return (
    stripped === noun ||
    stripped === alt ||
    stripped === `my ${noun}` ||
    stripped === `my ${alt}` ||
    new RegExp(`^(show|list|see)(\\s+me)?(\\s+(my|the))?\\s+(${names})$`).test(stripped)
  )
}

/** Routes one composer submission: the TUI's own words first, then the shared lane. */
export function routeComposerInput(input: string): ComposerRoute {
  const trimmed = input.trim()
  const shared = routeExplorerComposerInput(trimmed)
  if (shared.status !== 'text') return shared
  const word = trimmed.toLowerCase()
  if (word === 'accounts' || word === 'wallet') return { status: 'nav', screen: 'wallet' }
  if (isMineQuery(word, 'assets')) return { status: 'nav', screen: 'assets' }
  if (isMineQuery(word, 'apps')) return { status: 'nav', screen: 'apps' }
  if (isMineQuery(word, 'txns')) return { status: 'nav', screen: 'txns' }
  if (word === 'blocks' || word === 'live' || word === 'tail')
    return { status: 'nav', screen: 'blocks' }
  // Natural-language "show me my accounts" — not the wallet picker (`accounts`).
  if (isMineQuery(word, 'accounts')) return { status: 'account-list' }
  if (word === 'network') return { status: 'network' }
  const networkMatch = /^network\s+(localnet|testnet|mainnet)$/.exec(word)
  if (networkMatch) {
    return { status: 'network', network: networkMatch[1] as 'localnet' | 'testnet' | 'mainnet' }
  }
  if (word === 'help' || word === '?') return { status: 'help' }
  return shared
}
