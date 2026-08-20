import type { ResultStore, ViewSpec } from '@initlabs/vibekit-experience'
import type { LiveNetworkId } from '@initlabs/vibekit-experience/live'

import { Ident } from './ui.js'
import { ResultView } from './views.js'
import { COLORS, shorten } from './theme.js'

/** Workspace pages that sit beside the chat transcript. */
export type WorkspaceScreen = 'chat' | 'wallet' | 'assets' | 'apps' | 'txns'

const SHELF: ReadonlyArray<{ id: Exclude<WorkspaceScreen, 'chat' | 'wallet'>; label: string; shortcut: string }> = [
  { id: 'assets', label: 'assets', shortcut: '^1' },
  { id: 'apps', label: 'apps', shortcut: '^2' },
  { id: 'txns', label: 'txns', shortcut: '^3' },
]

function NavButton({
  label,
  shortcut,
  active,
  onPress,
}: {
  label: string
  shortcut: string
  active: boolean
  onPress: () => void
}) {
  return (
    <box
      onMouseDown={onPress}
      paddingX={1}
      backgroundColor={active ? COLORS.brass : COLORS.panel}
    >
      <text fg={active ? COLORS.ink : COLORS.muted}>{`${label} ${shortcut}`}</text>
    </box>
  )
}

/** Two-row masthead: brand/network, then wallet chip and shelf buttons. */
export function TopBar({
  screen,
  modeLabel,
  network,
  accountName,
  address,
  width,
  onOpenWallet,
  onOpenScreen,
  onSwitchNetwork,
}: {
  screen: WorkspaceScreen
  modeLabel: string
  network: LiveNetworkId
  accountName?: string
  address?: string
  width: number
  onOpenWallet: () => void
  onOpenScreen: (screen: Exclude<WorkspaceScreen, 'chat'>) => void
  onSwitchNetwork: () => void
}) {
  const compact = width < 88
  const walletLabel = address
    ? compact
      ? accountName ?? shorten(address, 10)
      : `${accountName ?? 'wallet'}  ${shorten(address, 12)}`
    : 'no wallet'
  const networkColors: Record<LiveNetworkId, string> = {
    localnet: COLORS.green,
    testnet: COLORS.brass,
    mainnet: COLORS.red,
  }
  return (
    <box flexDirection="column" height={2} backgroundColor={COLORS.panelRaised} paddingX={1}>
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <box flexDirection="row">
          <text fg={COLORS.brass}>◆ </text>
          <text fg={COLORS.faint}>VIBEKIT </text>
          <text fg={COLORS.brassBright}>EXPLORER</text>
        </box>
        <box flexDirection="row" onMouseDown={onSwitchNetwork}>
          <text fg={COLORS.faint}>{`${modeLabel}  `}</text>
          <text fg={COLORS.ink} bg={networkColors[network]}>
            {` ${network.toUpperCase()} `}
          </text>
          <text fg={COLORS.faint}> ^n</text>
        </box>
      </box>
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <box
          flexDirection="row"
          onMouseDown={onOpenWallet}
          paddingX={1}
          backgroundColor={screen === 'wallet' ? COLORS.brass : COLORS.panel}
        >
          <text fg={screen === 'wallet' ? COLORS.ink : COLORS.brassBright}>
            {`▸ ${shorten(walletLabel, compact ? 16 : 28)} ^w`}
          </text>
        </box>
        <box flexDirection="row">
          {SHELF.map((item) => (
            <NavButton
              key={item.id}
              label={item.label}
              shortcut={item.shortcut}
              active={screen === item.id}
              onPress={() => onOpenScreen(item.id)}
            />
          ))}
        </box>
      </box>
    </box>
  )
}

/** Keystore / sample address book: pick the active account for pay and shelves. */
export function WalletScreen({
  accounts,
  loading,
  signerReady,
  activeSender,
  width,
  onSelect,
}: {
  accounts: ReadonlyArray<{ address: string; name?: string }>
  loading: boolean
  signerReady: boolean
  activeSender: string | undefined
  width: number
  onSelect: (address: string) => void
}) {
  const inner = Math.max(24, width - 6)
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      padding={1}
      border
      borderStyle="rounded"
      borderColor={COLORS.brass}
      backgroundColor={COLORS.panel}
    >
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <text fg={COLORS.brassBright}>WALLET</text>
        <text fg={COLORS.faint}>{signerReady ? 'keystore' : 'sample'}</text>
      </box>
      <text fg={COLORS.muted} content="Active account is used for pay, assets, apps, and txns." />
      {loading ? (
        <text fg={COLORS.muted} marginTop={1} content="Loading accounts…" />
      ) : accounts.length === 0 ? (
        <text fg={COLORS.muted} marginTop={1} content="No accounts found" />
      ) : (
        accounts.map((account, index) => {
          const selected = account.address === activeSender
          return (
            <box
              key={account.address}
              flexDirection="column"
              marginTop={1}
              paddingX={1}
              backgroundColor={selected ? COLORS.panelRaised : undefined}
              onMouseDown={() => onSelect(account.address)}
            >
              <box flexDirection="row" justifyContent="space-between" height={1}>
                <text fg={selected ? COLORS.brassBright : COLORS.text}>
                  {`${selected ? '▸' : ' '}[${index + 1}] ${account.name ?? '—'}`}
                </text>
                {selected ? (
                  <text fg={COLORS.ink} bg={COLORS.brass}>
                    {' ACTIVE '}
                  </text>
                ) : null}
              </box>
              <Ident value={account.address} width={inner} />
            </box>
          )
        })
      )}
      <text
        fg={COLORS.faint}
        marginTop={1}
        content="[1-9] set active · [esc] chat · assets ^1 · apps ^2 · txns ^3"
      />
    </box>
  )
}

/** One account-scoped list (assets, apps, or txns) using existing cards. */
export function ShelfScreen({
  title,
  accountName,
  address,
  loading,
  error,
  empty,
  store,
  view,
  width,
}: {
  title: string
  accountName?: string
  address?: string
  loading: boolean
  error?: string
  empty: string
  store: ResultStore
  view?: ViewSpec
  width: number
}) {
  const inner = Math.max(24, width - 6)
  const owner = address ? (accountName ?? shorten(address, 16)) : 'no wallet'
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      padding={1}
      border
      borderStyle="rounded"
      borderColor={COLORS.border}
      backgroundColor={COLORS.panel}
    >
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <text fg={COLORS.brassBright}>{title}</text>
        <text fg={COLORS.muted}>{owner}</text>
      </box>
      {address ? <Ident value={address} width={inner} /> : null}
      {loading ? (
        <text fg={COLORS.muted} marginTop={1} content="Looking up…" />
      ) : error ? (
        <text fg={COLORS.red} marginTop={1} content={error} />
      ) : !address ? (
        <text fg={COLORS.muted} marginTop={1} content="Pick a wallet with ^w, then come back." />
      ) : view ? (
        <scrollbox flexGrow={1} marginTop={1} stickyScroll={false}>
          <ResultView store={store} view={view} width={Math.max(30, width - 6)} />
        </scrollbox>
      ) : (
        <text fg={COLORS.faint} marginTop={1} content={empty} />
      )}
      <text fg={COLORS.faint} marginTop={1} content="[esc] chat · ^w wallet · [ ] cycle account" />
    </box>
  )
}
