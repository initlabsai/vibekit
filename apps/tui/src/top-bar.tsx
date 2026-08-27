import type { LiveNetworkId } from '@initlabs/vibekit-explorer/live'
import { useEffect, useState } from 'react'

import { Button, LiveDot } from './primitives.js'
import { COLORS, shorten } from './theme.js'

/** The top-level screens. 'chat' is the transcript, labelled "explore" in the UI. */
export type Screen = 'chat' | 'wallet' | 'assets' | 'apps' | 'txns' | 'blocks' | 'plugins'

const SCREEN_TABS: ReadonlyArray<{
  id: Exclude<Screen, 'chat' | 'wallet'>
  label: string
  shortcut: string
}> = [
  { id: 'assets', label: 'assets', shortcut: '^1' },
  { id: 'apps', label: 'apps', shortcut: '^2' },
  { id: 'txns', label: 'txns', shortcut: '^3' },
  { id: 'blocks', label: 'blocks', shortcut: '^4' },
  { id: 'plugins', label: 'plugins', shortcut: '^5' },
]

/** The chain's heartbeat: signal-colored, flashes amber for a beat on each new round. */
function RoundTick({ round }: { round: number }) {
  const [hot, setHot] = useState(false)
  useEffect(() => {
    setHot(true)
    const id = setTimeout(() => setHot(false), 350)
    return () => clearTimeout(id)
  }, [round])
  return <text fg={hot ? COLORS.brassBright : COLORS.signal}>{String(round)}</text>
}

/**
 * Two-row masthead. Row one: brand, then network state (mode · network chip
 * with its key · round). Row two: the workspace pages on the left, the
 * active wallet on the right. Every clickable is a Button, the same
 * primitive the cards use, so "filled chip" always means "press me".
 */
export function TopBar({
  screen,
  modeLabel,
  live,
  network,
  latestRound,
  accountName,
  address,
  width,
  onOpenChat,
  onOpenWallet,
  onOpenScreen,
  onSwitchNetwork,
}: {
  screen: Screen
  modeLabel: string
  live: 'probing' | boolean
  network: LiveNetworkId
  latestRound?: number
  accountName?: string
  address?: string
  width: number
  onOpenChat: () => void
  onOpenWallet: () => void
  onOpenScreen: (screen: Exclude<Screen, 'chat'>) => void
  onSwitchNetwork: () => void
}) {
  // Three widths: full dress; the wallet chip joins the masthead row so the
  // nav row fits ~80 columns; then the nav sheds its ^N suffixes.
  const compact = width < 110
  const tight = width < 84
  const walletLabel = address
    ? compact
      ? (accountName ?? shorten(address, 10))
      : `${accountName ?? 'wallet'}  ${shorten(address, 12)}`
    : 'no wallet'
  const networkColors: Record<LiveNetworkId, string> = {
    localnet: COLORS.signal,
    testnet: COLORS.brass,
    // The one standing red: real money.
    mainnet: COLORS.red,
  }
  const wallet = (
    <Button
      label={`▸ ${shorten(walletLabel, compact ? 16 : 28)} ^w`}
      active={screen === 'wallet'}
      onPress={onOpenWallet}
    />
  )
  return (
    <box flexDirection="column" height={3} paddingX={2}>
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <box flexDirection="row">
          <text fg={COLORS.brass}>◆ </text>
          <text fg={COLORS.faint}>VIBEKIT </text>
          <text fg={COLORS.brassBright}>EXPLORER</text>
        </box>
        <box flexDirection="row" gap={compact ? 1 : 3}>
          <box flexDirection="row" gap={1}>
            <box flexDirection="row">
              <LiveDot live={live} />
              <text fg={COLORS.faint}>{modeLabel}</text>
            </box>
            {latestRound === undefined ? null : <RoundTick round={latestRound} />}
          </box>
          <box paddingX={1} onMouseDown={onSwitchNetwork}>
            <text fg={networkColors[network]}>{`${network.toUpperCase()} ^n`}</text>
          </box>
          {compact ? wallet : null}
        </box>
      </box>
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <box flexDirection="row" gap={tight ? 1 : 2}>
          <Button
            label={tight ? 'explore' : 'explore esc'}
            active={screen === 'chat'}
            onPress={onOpenChat}
          />
          {SCREEN_TABS.map((item) => (
            <Button
              key={item.id}
              label={tight ? item.label : `${item.label} ${item.shortcut}`}
              active={screen === item.id}
              onPress={() => onOpenScreen(item.id)}
            />
          ))}
        </box>
        {compact ? null : wallet}
      </box>
      <text fg={COLORS.borderSoft} content={'─'.repeat(Math.max(0, width - 4))} />
    </box>
  )
}
