import algosdk from 'algosdk'
import {
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  routeExplorerComposerInput,
  type ExplorerComposerRoute,
  type LiveNetworkId,
} from '@initlabs/vibekit-explorer'

/** The composer's deterministic lane: the app's own words first, then the shared Explorer routes. */
export type ComposerRoute =
  | ExplorerComposerRoute
  | { status: 'nav'; screen: 'wallet' | 'assets' | 'apps' | 'txns' | 'blocks' }
  | { status: 'account-list' }
  | { status: 'network'; network?: LiveNetworkId }
  | { status: 'help' }

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
  if (isMineQuery(word, 'accounts')) return { status: 'account-list' }
  if (word === 'network') return { status: 'network' }
  const networkMatch = /^network\s+(localnet|testnet|mainnet)$/.exec(word)
  if (networkMatch) return { status: 'network', network: networkMatch[1] as LiveNetworkId }
  if (word === 'help' || word === '?') return { status: 'help' }
  return shared
}

/** A connected wallet account as the composer can name it. */
export interface WalletAccount {
  address: string
  name?: string
}

/**
 * Parties for a typed `pay`. On the sample host the fixture parties stand in
 * so the flow still demos offline. Live, the sender is the connected active
 * account and the receiver must be named — a wallet label or a checksum-valid
 * address. No wallet means no draft.
 */
export function resolvePaymentParties(args: {
  live: boolean
  accounts: ReadonlyArray<WalletAccount>
  activeAddress: string | undefined
  to: string | undefined
}): { sender: string; receiver: string } | { error: string } {
  const { live, accounts, activeAddress, to } = args
  if (!live) {
    if (to !== undefined && !algosdk.isValidAddress(to)) {
      return { error: `"${to}" is not a valid address — sample mode pays fixture accounts only` }
    }
    return { sender: FIXTURE_SENDER, receiver: to ?? FIXTURE_RECEIVER }
  }
  if (accounts.length === 0) return { error: 'connect a wallet to pay' }
  const known = accounts.some((account) => account.address === activeAddress)
  const sender = known && activeAddress ? activeAddress : accounts[0]!.address
  if (!to) return { error: 'Name the receiver: pay <amount> to <wallet label | address>' }
  if (algosdk.isValidAddress(to)) return { sender, receiver: to }
  if (/^[A-Z2-7]{58}$/.test(to)) return { error: `"${to.slice(0, 8)}…" fails its checksum — check the address` }
  const matches = accounts.filter((account) => account.name?.toLowerCase() === to.toLowerCase())
  if (matches.length === 1) return { sender, receiver: matches[0]!.address }
  if (matches.length > 1) return { error: `"${to}" matches ${matches.length} accounts — use an address` }
  return { error: `No connected account named "${to}" — use a wallet label or an address` }
}

export const HELP =
  'pay 0.5 to <address> · asset 31566704 · app 1002541853 · block 1000 · network testnet · paste a txid or address'
