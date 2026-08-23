import { formatMicroAlgos, type ResultStore, type ViewSpec } from '@initlabs/vibekit-explorer'
import type { LiveNetworkId } from '@initlabs/vibekit-explorer/live'
import type { InputRenderable, SubmitEvent as OpenTUISubmitEvent } from '@opentui/core'

import { useEffect, useState, type RefObject } from 'react'

import { Button, Ident } from './ui.js'
import { ResultView, type OpenTarget } from './views.js'
import type { AppsEntry, SpecSelection } from './slices/apps.js'
import type { ParsedMethod } from '@initlabs/vibekit-tools'
import { COLORS, shorten } from './theme.js'

/** Workspace pages that sit beside the chat transcript. */
export type WorkspaceScreen = 'chat' | 'wallet' | 'assets' | 'apps' | 'txns' | 'blocks'

const SHELF: ReadonlyArray<{ id: Exclude<WorkspaceScreen, 'chat' | 'wallet'>; label: string; shortcut: string }> = [
  { id: 'assets', label: 'assets', shortcut: '^1' },
  { id: 'apps', label: 'apps', shortcut: '^2' },
  { id: 'txns', label: 'txns', shortcut: '^3' },
  { id: 'blocks', label: 'blocks', shortcut: '^4' },
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
  screen: WorkspaceScreen
  modeLabel: string
  network: LiveNetworkId
  latestRound?: number
  accountName?: string
  address?: string
  width: number
  onOpenChat: () => void
  onOpenWallet: () => void
  onOpenScreen: (screen: Exclude<WorkspaceScreen, 'chat'>) => void
  onSwitchNetwork: () => void
}) {
  const compact = width < 88
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
  return (
    <box flexDirection="column" height={4} backgroundColor={COLORS.surface} paddingX={2} paddingY={1}>
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <box flexDirection="row">
          <text fg={COLORS.brass}>◆ </text>
          <text fg={COLORS.faint}>VIBEKIT </text>
          <text fg={COLORS.brassBright}>EXPLORER</text>
        </box>
        <box flexDirection="row" gap={3}>
          <box flexDirection="row" gap={1}>
            <text fg={COLORS.faint}>{modeLabel}</text>
            {latestRound === undefined ? null : <RoundTick round={latestRound} />}
          </box>
          <box paddingX={1} backgroundColor={networkColors[network]} onMouseDown={onSwitchNetwork}>
            <text fg={COLORS.ink}>{`${network.toUpperCase()} ^n`}</text>
          </box>
        </box>
      </box>
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <box flexDirection="row" gap={2}>
          <Button label="explore esc" active={screen === 'chat'} onPress={onOpenChat} />
          {SHELF.map((item) => (
            <Button
              key={item.id}
              label={`${item.label} ${item.shortcut}`}
              active={screen === item.id}
              onPress={() => onOpenScreen(item.id)}
            />
          ))}
        </box>
        <Button
          label={`▸ ${shorten(walletLabel, compact ? 16 : 28)} ^w`}
          active={screen === 'wallet'}
          onPress={onOpenWallet}
        />
      </box>
    </box>
  )
}

/** Keystore / sample address book: pick the active account for pay and shelves. */
export function WalletScreen({
  accounts,
  loading,
  signer,
  network,
  balances,
  activeSender,
  width,
  onSelect,
  keys,
}: {
  /** Key hints for this screen, drawn in the bottom frame line. */
  keys: string
  accounts: ReadonlyArray<{ address: string; name?: string }>
  loading: boolean
  /** down: no daemon; empty: daemon up, no keys; ready: keystore accounts. */
  signer: 'down' | 'empty' | 'ready'
  network: string
  /** address → microALGO on `network`; missing means not funded there (or still loading). */
  balances: Record<string, number | string>
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
      borderStyle="heavy"
      borderColor={COLORS.brass}
      title={` WALLET · ${signer === 'ready' ? 'keystore' : signer === 'empty' ? 'keystore (empty)' : 'sample'} `}
      titleColor={COLORS.brassBright}
      bottomTitle={` ${shorten(keys, Math.max(8, width - 6))} `}
      bottomTitleAlignment="right"
      backgroundColor={COLORS.background}
    >
      <text
        fg={COLORS.muted}
        content={`Active account is used for pay, assets, apps, and txns. Balances on ${network}.`}
      />
      {signer === 'down' ? (
        <text
          fg={COLORS.brass}
          marginTop={1}
          content="Keystore daemon isn't running — vibekit keystore start, then reopen the Explorer. Showing sample accounts."
        />
      ) : signer === 'empty' ? (
        <text
          fg={COLORS.brass}
          marginTop={1}
          content="No keystore accounts yet — vibekit keystore generate ed25519 --name alice, then ^w."
        />
      ) : null}
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
              backgroundColor={selected ? COLORS.surface : undefined}
              onMouseDown={() => onSelect(account.address)}
            >
              <box flexDirection="row" justifyContent="space-between" height={1}>
                <text fg={selected ? COLORS.brassBright : COLORS.text}>
                  {`${selected ? '▸' : ' '}[${index + 1}] ${account.name ?? '—'}`}
                </text>
                <box flexDirection="row" gap={2}>
                  <text fg={balances[account.address] === undefined ? COLORS.faint : COLORS.brassBright}>
                    {balances[account.address] === undefined
                      ? '—'
                      : `${formatMicroAlgos(balances[account.address]!)} ALGO`}
                  </text>
                  {selected ? (
                    <text fg={COLORS.ink} bg={COLORS.brass}>
                      {' ACTIVE '}
                    </text>
                  ) : null}
                </box>
              </box>
              {/* Plain text on purpose: a click here selects the account; drag still copies. */}
              <text fg={selected ? COLORS.signal : COLORS.muted} content={shorten(account.address, inner)} />
            </box>
          )
        })
      )}
    </box>
  )
}

function formatCallResult(result: unknown): string {
  if (result === null || result === undefined) return ''
  if (typeof result !== 'object') return String(result)
  const record = result as {
    wouldSucceed?: boolean
    failureMessage?: string
    returns?: Array<{ value?: unknown }>
  }
  const lines: string[] = []
  if (typeof record.wouldSucceed === 'boolean') {
    lines.push(record.wouldSucceed ? 'simulate: would succeed' : 'simulate: would fail')
  }
  if (record.failureMessage) lines.push(record.failureMessage)
  const value = record.returns?.[0]?.value
  if (value !== undefined) {
    lines.push(`return: ${typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)}`)
  }
  return lines.join('\n') || JSON.stringify(result)
}

function MethodCallPane({
  selected,
  method,
  width,
  callEpoch,
  callBusy,
  callError,
  callResult,
  onInput,
  onSubmit,
  inputRef,
}: {
  selected: SpecSelection
  method: ParsedMethod
  width: number
  inputRef?: RefObject<InputRenderable | null>
  callEpoch: number
  callBusy: boolean
  callError: string | null
  callResult: unknown
  onInput: (value: string) => void
  onSubmit: () => void
}) {
  const readonly = method.readonly === true
  const argHint =
    method.args.length === 0
      ? 'no args — enter simulates'
      : `JSON args, e.g. {${method.args.map((arg) => `"${arg.name ?? 'arg'}": …`).join(', ')}}`
  const submitHandler = onSubmit as unknown as ((event: OpenTUISubmitEvent) => void) & (() => void)
  return (
    <box flexGrow={1} flexDirection="column">
      <text fg={COLORS.brassBright} marginTop={1} content={shorten(method.signature, width - 6)} />
      {method.description ? <text fg={COLORS.muted} content={shorten(method.description, width - 6)} /> : null}
      <text
        fg={COLORS.faint}
        content={
          selected.appId === undefined
            ? 'No deployed app id bound for this spec name.'
            : `app ${selected.appId}${readonly ? ' · read (simulate)' : ' · write'}`
        }
      />
      {readonly ? (
        <>
          <text fg={COLORS.muted} marginTop={1} content={argHint} />
          <box
            height={3}
            marginTop={1}
            flexDirection="row"
            alignItems="center"
            paddingX={1}
            border
            borderStyle="single"
            borderColor={COLORS.brass}
          >
            <text fg={COLORS.brassBright}>❯ </text>
            <input
              key={callEpoch}
              ref={inputRef}
              flexGrow={1}
              focused
              placeholder={method.args.length === 0 ? 'enter to simulate' : '{ ... }'}
              onInput={onInput}
              onSubmit={submitHandler}
            />
          </box>
          {callBusy ? <text fg={COLORS.muted} marginTop={1} content="Simulating…" /> : null}
          {callError ? <text fg={COLORS.brassBright} marginTop={1} content={callError} /> : null}
          {callResult !== null ? (
            <text fg={COLORS.text} marginTop={1} content={formatCallResult(callResult)} />
          ) : null}
        </>
      ) : (
        <>
          <text fg={COLORS.muted} marginTop={1} content="Write methods wait for the approval-flow drop." />
        </>
      )}
    </box>
  )
}

function SpecDetailPane({
  selected,
  selectedMethod,
  width,
  callEpoch,
  callBusy,
  callError,
  callResult,
  onSelectMethod,
  onInput,
  onSubmit,
  inputRef,
}: {
  selected: SpecSelection
  selectedMethod: ParsedMethod | null
  width: number
  inputRef?: RefObject<InputRenderable | null>
  callEpoch: number
  callBusy: boolean
  callError: string | null
  callResult: unknown
  onSelectMethod: (method: ParsedMethod) => void
  onInput: (value: string) => void
  onSubmit: () => void
}) {
  const { spec } = selected.spec
  if (selectedMethod) {
    return (
      <MethodCallPane
        selected={selected}
        method={selectedMethod}
        width={width}
        callEpoch={callEpoch}
        callBusy={callBusy}
        callError={callError}
        callResult={callResult}
        onInput={onInput}
        onSubmit={onSubmit}
        inputRef={inputRef}
      />
    )
  }
  const schemaLine =
    `state: ${spec.schema.globalInts} global ints · ${spec.schema.globalBytes} global bytes · ` +
    `${spec.schema.localInts} local ints · ${spec.schema.localBytes} local bytes`
  const methods = spec.methods.slice(0, 9)
  return (
    <box flexGrow={1} flexDirection="column">
      <box flexDirection="row" justifyContent="space-between" height={1} marginTop={1}>
        <text fg={COLORS.brassBright}>{spec.name}</text>
        <text fg={COLORS.faint}>{spec.format.toUpperCase()}</text>
      </box>
      <text fg={COLORS.faint} content={shorten(selected.spec.path, width - 6)} />
      {selected.appId !== undefined ? (
        <text fg={COLORS.muted} content={`deployed app ${selected.appId}`} />
      ) : (
        <text fg={COLORS.faint} content="Not bound to a deployed app on this network." />
      )}
      {spec.description ? <text fg={COLORS.muted} content={shorten(spec.description, width - 6)} /> : null}
      <text fg={COLORS.muted} marginTop={1} content={schemaLine} />
      {spec.templateVariables.length > 0 ? (
        <text fg={COLORS.muted} content={`templates: ${spec.templateVariables.join(', ')}`} />
      ) : null}
      <text fg={COLORS.brassBright} marginTop={1} content={`METHODS (${spec.methods.length})`} />
      <scrollbox flexGrow={1} stickyScroll={false}>
        {methods.length === 0 ? (
          <text fg={COLORS.muted} content="No ABI methods declared." />
        ) : (
          methods.map((method, index) => (
            <box key={method.signature} flexDirection="column" onMouseDown={() => onSelectMethod(method)}>
              <text
                fg={COLORS.text}
                content={shorten(
                  `[${index + 1}] ${method.readonly ? 'read' : 'write'} ${method.signature}`,
                  width - 6,
                )}
              />
              {method.description ? (
                <text fg={COLORS.faint} content={`  ${shorten(method.description, width - 8)}`} />
              ) : null}
            </box>
          ))
        )}
      </scrollbox>
    </box>
  )
}

function appsRowLabel(entry: AppsEntry, index: number, width: number): string {
  const prefix = `[${index + 1}] `
  if (entry.kind === 'deployed') return `${prefix}${entry.name} · app ${entry.appId}`
  if (entry.kind === 'optedIn') {
    return entry.name
      ? `${prefix}${entry.name} · app ${entry.appId}`
      : `${prefix}app ${entry.appId}`
  }
  return shorten(
    `${prefix}${entry.spec.spec.name} · ${entry.spec.spec.methods.length} method${entry.spec.spec.methods.length === 1 ? '' : 's'} · ${entry.spec.path}`,
    width - 6,
  )
}

/** My Apps: deployed associations, opted-in apps for the active account, local specs. */
export function AppsScreen({
  network,
  entries,
  selected,
  selectedMethod,
  sender,
  optedInLoading,
  width,
  onActivate,
  onSelectMethod,
  callEpoch,
  callBusy,
  callError,
  callResult,
  onInput,
  onSubmit,
  inputRef,
  keys,
}: {
  /** Key hints for this screen, drawn in the bottom frame line. */
  keys: string
  network: string
  entries: ReadonlyArray<AppsEntry>
  selected: SpecSelection | null
  selectedMethod: ParsedMethod | null
  sender?: string
  optedInLoading: boolean
  width: number
  onActivate: (index: number) => void
  onSelectMethod: (method: ParsedMethod) => void
  callEpoch: number
  callBusy: boolean
  callError: string | null
  callResult: unknown
  onInput: (value: string) => void
  onSubmit: () => void
  inputRef?: RefObject<InputRenderable | null>
}) {
  const deployed = entries.filter((entry) => entry.kind === 'deployed')
  const optedIn = entries.filter((entry) => entry.kind === 'optedIn')
  const locals = entries.filter((entry) => entry.kind === 'local')
  const optedOffset = deployed.length
  const localOffset = deployed.length + optedIn.length
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      padding={1}
      border
      borderStyle="heavy"
      borderColor={COLORS.brass}
      title={` MY APPS · ${network} `}
      titleColor={COLORS.brassBright}
      bottomTitle={` ${shorten(keys, Math.max(8, width - 6))} `}
      bottomTitleAlignment="right"
      backgroundColor={COLORS.background}
    >
      {selected ? (
        <SpecDetailPane
          selected={selected}
          selectedMethod={selectedMethod}
          width={width}
          callEpoch={callEpoch}
          callBusy={callBusy}
          callError={callError}
          callResult={callResult}
          onSelectMethod={onSelectMethod}
          onInput={onInput}
          onSubmit={onSubmit}
          inputRef={inputRef}
        />
      ) : (
        <>
          <scrollbox flexGrow={1} stickyScroll={false}>
            <text fg={COLORS.muted} marginTop={1} content={`Deployed (${network})`} />
            {deployed.length === 0 ? (
              <text fg={COLORS.faint} content="  No deployed apps recorded on this network yet." />
            ) : (
              deployed.map((entry, index) => (
                <box
                  key={`deployed-${entry.name}-${entry.appId}`}
                  paddingX={1}
                  onMouseDown={() => onActivate(index + 1)}
                >
                  <text fg={COLORS.text} content={appsRowLabel(entry, index, width)} />
                </box>
              ))
            )}
            <text fg={COLORS.muted} marginTop={1} content="Opted in (this account)" />
            {optedInLoading ? (
              <text fg={COLORS.faint} content="  Looking up…" />
            ) : !sender ? (
              <text fg={COLORS.faint} content="  Pick a wallet with ^w first." />
            ) : optedIn.length === 0 ? (
              <text fg={COLORS.faint} content="  No opted-in apps for this account." />
            ) : (
              optedIn.map((entry, index) => (
                <box
                  key={`opted-${entry.appId}`}
                  paddingX={1}
                  onMouseDown={() => onActivate(optedOffset + index + 1)}
                >
                  <text fg={COLORS.text} content={appsRowLabel(entry, optedOffset + index, width)} />
                </box>
              ))
            )}
            <text fg={COLORS.muted} marginTop={1} content="Local specs (not deployed)" />
            {locals.length === 0 ? (
              <text fg={COLORS.faint} content="  No app specs found under the launch directory." />
            ) : (
              locals.map((entry, index) => (
                <box
                  key={entry.spec.path}
                  paddingX={1}
                  onMouseDown={() => onActivate(localOffset + index + 1)}
                >
                  <text fg={COLORS.text} content={appsRowLabel(entry, localOffset + index, width)} />
                </box>
              ))
            )}
          </scrollbox>
        </>
      )}
    </box>
  )
}

/** One account-scoped list (assets or txns) using existing cards. */
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
  onOpen,
  onMore,
  loadingMore,
  keys,
}: {
  /** Key hints for this screen, drawn in the bottom frame line. */
  keys: string
  title: string
  accountName?: string
  address?: string
  loading: boolean
  error?: string
  empty: string
  store: ResultStore
  view?: ViewSpec
  width: number
  onOpen: (target: OpenTarget) => void
  onMore: () => void
  loadingMore: boolean
}) {
  const inner = Math.max(24, width - 6)
  const owner = address ? (accountName ?? shorten(address, 16)) : 'no wallet'
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      padding={1}
      border
      borderStyle="heavy"
      borderColor={COLORS.brass}
      title={` ${title} · ${owner} `}
      titleColor={COLORS.brassBright}
      bottomTitle={` ${shorten(keys, Math.max(8, width - 6))} `}
      bottomTitleAlignment="right"
      backgroundColor={COLORS.background}
    >
      {address ? <Ident value={address} width={inner} /> : null}
      {loading ? (
        <text fg={COLORS.muted} marginTop={1} content="Looking up…" />
      ) : error ? (
        <text fg={COLORS.brassBright} marginTop={1} content={error} />
      ) : !address ? (
        <text fg={COLORS.muted} marginTop={1} content="Pick a wallet with ^w, then come back." />
      ) : view ? (
        <scrollbox flexGrow={1} marginTop={1} stickyScroll={false}>
          <ResultView
            store={store}
            view={view}
            width={Math.max(30, width - 6)}
            onOpen={onOpen}
            onMore={onMore}
            loadingMore={loadingMore}
          />
        </scrollbox>
      ) : (
        <text fg={COLORS.faint} marginTop={1} content={empty} />
      )}
    </box>
  )
}

/** Live block tail: only fetches while this page is open and not paused. */
export function BlocksScreen({
  network,
  live,
  running,
  paused,
  latestRound,
  error,
  store,
  views,
  width,
  onToggle,
  onOpen,
  keys,
}: {
  /** Key hints for this screen, drawn in the bottom frame line. */
  keys: string
  network: string
  live: 'probing' | boolean
  running: boolean
  paused: boolean
  latestRound?: number
  error?: string
  store: ResultStore
  views: readonly ViewSpec[]
  width: number
  onToggle: () => void
  onOpen: (target: OpenTarget) => void
}) {
  const inner = Math.max(30, width - 6)
  const pill =
    live === 'probing'
      ? 'probing…'
      : live !== true
        ? 'sample — no tail'
        : running
          ? 'LIVE'
          : paused
            ? 'STOPPED'
            : 'idle'
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      padding={1}
      border
      borderStyle={running ? 'heavy' : 'single'}
      borderColor={running ? COLORS.brass : COLORS.border}
      title={` BLOCKS · ${pill} · ${network}${latestRound === undefined ? '' : ` · ${latestRound}`} `}
      titleColor={running ? COLORS.signal : COLORS.brassBright}
      bottomTitle={` ${shorten(keys, Math.max(8, width - 6))} `}
      bottomTitleAlignment="right"
      backgroundColor={COLORS.background}
    >
      {live === true ? (
        <box flexDirection="row" height={1}>
          <Button label={running ? '■ stop' : '▶ start'} onPress={onToggle} active={running} />
        </box>
      ) : null}
      {live !== true ? (
        <text
          fg={COLORS.muted}
          marginTop={1}
          content="Need a live network for the tail. ^n to switch, then open this page again."
        />
      ) : error ? (
        <text fg={COLORS.brassBright} marginTop={1} content={error} />
      ) : views.length === 0 ? (
        <text
          fg={COLORS.faint}
          marginTop={1}
          content={running ? 'Waiting for the next block…' : 'space starts the tail.'}
        />
      ) : (
        <scrollbox flexGrow={1} marginTop={1} stickyScroll stickyStart="top">
          {/* Newest block on top: the tail reads like a ticker, not a log. */}
          {views
            .map((view, index) => (
              <ResultView
                key={`${view.source.id}-${index}`}
                store={store}
                view={view}
                width={inner}
                onOpen={onOpen}
              />
            ))
            .reverse()}
        </scrollbox>
      )}
    </box>
  )
}

/** The single input line at the bottom of the chat screen. */
export function Composer({
  epoch,
  focused,
  hint,
  inputRef,
  onFocus,
  onSubmit,
}: {
  epoch: number
  focused: boolean
  hint: string
  inputRef: RefObject<InputRenderable | null>
  /** A click on the composer claims app focus, like esc does from the feed. */
  onFocus: () => void
  onSubmit: (value: string) => void
}) {
  // OpenTUI's intrinsic type currently intersects its core SubmitEvent prop
  // with the React adapter's string callback; runtime behavior is the latter.
  const submitHandler = onSubmit as unknown as ((event: OpenTUISubmitEvent) => void) &
    ((value: string) => void)

  return (
    <box
      height={3}
      flexDirection="row"
      alignItems="center"
      paddingX={1}
      border
      borderStyle={focused ? 'heavy' : 'single'}
      borderColor={focused ? COLORS.brass : COLORS.border}
      backgroundColor={COLORS.surface}
      onMouseDown={onFocus}
    >
      <text fg={focused ? COLORS.brassBright : COLORS.faint}>❯ </text>
      {/* Remount per submit: the input keeps its own buffer, so a fresh key is
          the only reliable way to clear it. */}
      <input
        key={epoch}
        ref={inputRef}
        flexGrow={1}
        focused={focused}
        placeholder={hint}
        onSubmit={submitHandler}
      />
    </box>
  )
}
