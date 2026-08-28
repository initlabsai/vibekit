import algosdk from 'algosdk'
import {
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  routeExplorerComposerInput,
  type ExplorerComposerRoute,
  type LiveNetworkId,
} from '@initlabs/vibekit-explorer'

/** The composer's deterministic lane: slash commands, then the shared Explorer routes for pasted ids. */
export type ComposerRoute =
  | ExplorerComposerRoute
  | { status: 'nav'; screen: 'wallet' | 'assets' | 'apps' | 'txns' | 'blocks' }
  | { status: 'account-list' }
  | { status: 'network'; network?: LiveNetworkId }
  | { status: 'network-status' }
  | { status: 'buy' }
  | { status: 'help' }

export interface SlashCommand {
  name: string
  hint: string
  /** What Enter puts in the composer when the command wants arguments; absent means run at once. */
  template?: string
}

/** Every `/` command, in palette order; `/help` lists the same array. */
export const COMMANDS: ReadonlyArray<SlashCommand> = [
  { name: 'assets', hint: 'your assets' },
  { name: 'apps', hint: 'your applications' },
  { name: 'txns', hint: 'your transactions' },
  { name: 'blocks', hint: 'follow the chain' },
  { name: 'wallet', hint: 'connect or switch wallets' },
  { name: 'accounts', hint: 'every connected account, with balances' },
  { name: 'status', hint: 'network health' },
  { name: 'buy', hint: 'buy agent turns with USDC' },
  { name: 'network', hint: 'switch network', template: '/network mainnet' },
  { name: 'pay', hint: 'draft a payment for your wallet to sign', template: '/pay 0.5 to ' },
  { name: 'asset', hint: 'open an asset by id', template: '/asset ' },
  { name: 'app', hint: 'open an application by id', template: '/app ' },
  { name: 'block', hint: 'open a block by round', template: '/block ' },
  { name: 'help', hint: 'this list' },
]

/** Commands whose name starts with what follows the slash; everything while the input is just `/`. */
export function matchCommands(input: string): ReadonlyArray<SlashCommand> {
  if (!input.startsWith('/') || /\s/.test(input)) return []
  const prefix = input.slice(1).toLowerCase()
  return COMMANDS.filter((command) => command.name.startsWith(prefix))
}

export function routeComposerInput(input: string): ComposerRoute {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) {
    // Pasted ids, names, and `pay …` stay deterministic; any other words go to the agent.
    return routeExplorerComposerInput(trimmed)
  }
  const [word = '', ...rest] = trimmed.slice(1).toLowerCase().split(/\s+/)
  const arg = rest.join(' ')
  switch (word) {
    case 'assets':
    case 'apps':
    case 'txns':
    case 'blocks':
    case 'wallet':
      return { status: 'nav', screen: word }
    case 'accounts':
      return { status: 'account-list' }
    case 'status':
      return { status: 'network-status' }
    case 'buy':
      return { status: 'buy' }
    case 'help':
      return { status: 'help' }
    case 'network':
      return arg === 'localnet' || arg === 'testnet' || arg === 'mainnet' ? { status: 'network', network: arg } : { status: 'network' }
    default:
      // `/pay …`, `/asset 31566704`, `/app …`, `/block …` are the shared routes without the slash.
      return routeExplorerComposerInput(trimmed.slice(1))
  }
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

export const HELP = `${COMMANDS.map((command) => `/${command.name} — ${command.hint}`).join('\n')}\npaste a txid, address, name.algo, or numeric id to open it; anything else goes to the agent`
