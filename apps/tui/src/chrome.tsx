import { formatMicroAlgos, type ResultStore, type ViewSpec } from '@initlabs/vibekit-explorer'
import type { LiveNetworkId } from '@initlabs/vibekit-explorer/live'
import type { InputRenderable, SubmitEvent as OpenTUISubmitEvent } from '@opentui/core'

import { useEffect, useState, type RefObject } from 'react'

import { Button, Fact, FooterNote, Frame, Header, Hero, HighlightContext, Ident, innerWidth, Rule, usePulse } from './ui.js'
import { ResultView, type OpenTarget } from './views.js'
import { deployMethod, type AppGroup, type AppStateEntry, type SpecSelection } from './slices/apps.js'
import type { ParsedMethod } from '@initlabs/vibekit/tools'
import { methodPrompt } from './method-args.js'
import { breath, COLORS, shorten } from './theme.js'

/** Workspace pages that sit beside the chat transcript. */
export type WorkspaceScreen = 'chat' | 'wallet' | 'assets' | 'apps' | 'txns' | 'blocks' | 'plugins'

const SHELF: ReadonlyArray<{ id: Exclude<WorkspaceScreen, 'chat' | 'wallet'>; label: string; shortcut: string }> = [
  { id: 'assets', label: 'assets', shortcut: '^1' },
  { id: 'apps', label: 'apps', shortcut: '^2' },
  { id: 'txns', label: 'txns', shortcut: '^3' },
  { id: 'blocks', label: 'blocks', shortcut: '^4' },
  { id: 'plugins', label: 'plugins', shortcut: '^5' },
]

const TEAL_BREATH = breath(COLORS.signalDim, COLORS.signal, 4)

/** A slow teal breath beside the mode label while the network is live; still otherwise. */
function LiveDot({ live }: { live: 'probing' | boolean }) {
  const phase = usePulse(1800, TEAL_BREATH.length)
  if (live !== true) return <text fg={COLORS.faint}>○ </text>
  return <text fg={TEAL_BREATH[phase]}>● </text>
}

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
  screen: WorkspaceScreen
  modeLabel: string
  live: 'probing' | boolean
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
          <Button label={tight ? 'explore' : 'explore esc'} active={screen === 'chat'} onPress={onOpenChat} />
          {SHELF.map((item) => (
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

/** Enable/disable the session's tool plugins; persisted to ~/.config/vibekit. */
export function PluginsScreen({
  plugins,
  width,
  onToggle,
  keys,
}: {
  plugins: ReadonlyArray<{ name: string; description?: string; enabled: boolean }>
  width: number
  onToggle: (name: string) => void
  /** Key hints for this screen, drawn in the bottom frame line. */
  keys: string
}) {
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      padding={1}
      border
      borderStyle="heavy"
      borderColor={COLORS.brass}
      title=" PLUGINS "
      titleColor={COLORS.brassBright}
      bottomTitle={` ${shorten(keys, Math.max(8, width - 6))} `}
      bottomTitleAlignment="right"
      backgroundColor={COLORS.background}
    >
      <text
        fg={COLORS.muted}
        content="Extra tools the agent can call. Changes save to ~/.config/vibekit and apply on the agent's next message."
      />
      {plugins.map((plugin, index) => (
        <box key={plugin.name} flexDirection="column" marginTop={1} paddingX={1}>
          <box flexDirection="row" justifyContent="space-between" height={1}>
            <text fg={plugin.enabled ? COLORS.brassBright : COLORS.faint}>
              {`[${index + 1}] ${plugin.name}`}
            </text>
            <Button
              label={plugin.enabled ? 'enabled' : 'disabled'}
              active={plugin.enabled}
              onPress={() => onToggle(plugin.name)}
            />
          </box>
          {plugin.description ? <text fg={COLORS.muted}>{`    ${plugin.description}`}</text> : null}
        </box>
      ))}
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

/**
 * The call block under a picked method: the method line. Values go in
 * positionally, as name=value, or as JSON; reads simulate on enter, writes
 * compose and hand off to the approval card.
 */
function MethodCall({
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
  deploy = false,
}: {
  selected: SpecSelection
  method: ParsedMethod
  width: number
  /** The deploy line: template values instead of ABI args. */
  deploy?: boolean
  inputRef?: RefObject<InputRenderable | null>
  callEpoch: number
  callBusy: boolean
  callError: string | null
  callResult: unknown
  onInput: (value: string) => void
  onSubmit: () => void
}) {
  const readonly = method.readonly === true
  const submitHandler = onSubmit as unknown as ((event: OpenTUISubmitEvent) => void) & (() => void)
  const example = method.args
    .map((arg) => {
      const t = arg.type
      if (t === 'string') return '"hi"'
      if (t === 'bool') return 'true'
      if (t === 'account' || t === 'address') return 'ADDR'
      if (t === 'asset' || t === 'application' || /^uint\d+$/.test(t)) return '1'
      if (t === 'pay') return '{"type":"pay","receiver":"ADDR","amount":1000}'
      return 'JSON'
    })
    .join(' ')
  const mode = deploy
    ? 'TMPL_ values for this build, then review + sign the create'
    : selected.appId === undefined
      ? 'not deployed here'
      : readonly
        ? `read · simulates on app ${selected.appId}`
        : `write · composes for app ${selected.appId}, then review + sign`
  return (
    <box flexDirection="column" paddingLeft={4}>
      <text fg={COLORS.faint} content={shorten(mode, width - 4)} />
      <box height={3} flexDirection="row" alignItems="center" paddingX={1} border borderStyle="single" borderColor={COLORS.brass}>
        <text fg={COLORS.brassBright}>{`${methodPrompt(method)} ❯ `}</text>
        <input
          key={callEpoch}
          ref={inputRef}
          flexGrow={1}
          focused
          placeholder={deploy ? method.args.map((arg) => `${arg.name}=…`).join(' ') : method.args.length === 0 ? (readonly ? 'enter to simulate' : 'enter to compose') : example}
          onInput={onInput}
          onSubmit={submitHandler}
        />
      </box>
      <text
        fg={COLORS.faint}
        content={shorten(
          deploy
            ? 'name=value per template variable · numbers stay numbers'
            : method.args.length === 0
              ? 'no args'
              : readonly
                ? 'values in order, name=value, or JSON · txn args as JSON · resources are found for you'
                : 'values in order, name=value, or JSON · +fund 0.2 pays the app account in the group · +fee 0.002 for inner txns',
          width - 4,
        )}
      />
      {callBusy ? <text fg={COLORS.muted} content={readonly && !deploy ? 'Simulating…' : 'Composing…'} /> : null}
      {callError ? <text fg={COLORS.brassBright} content={shorten(callError, width - 4)} /> : null}
      {callResult !== null ? <text fg={COLORS.text} content={formatCallResult(callResult)} /> : null}
    </box>
  )
}

/**
 * One contract as a card: status, deployments, spec facts, ARC-56 state keys
 * (live values once bound), and the method list. Selected, the methods take
 * numbers and the picked one opens its call block inline.
 */
function AppGroupCard({
  group,
  sender,
  accountName,
  index,
  selected,
  selectedMethod,
  deployOpen = false,
  globalState,
  network,
  width,
  onActivate,
  onSelectMethod,
  onOpen,
  ...call
}: {
  group: AppGroup
  /** Active account, to mark deployments it created. */
  sender?: string
  accountName?: string
  /** List position; the kicker carries it so digits map to cards. */
  index?: number
  selected?: SpecSelection
  selectedMethod: ParsedMethod | null
  /** The deploy line is open under the methods. */
  deployOpen?: boolean
  globalState: AppStateEntry[] | null
  network: string
  width: number
  onActivate?: () => void
  onSelectMethod: (method: ParsedMethod) => void
  /** Opens the newest deployment's record; absent when nothing is on-chain. */
  onOpen?: () => void
  inputRef?: RefObject<InputRenderable | null>
  callEpoch: number
  callBusy: boolean
  callError: string | null
  callResult: unknown
  onInput: (value: string) => void
  onSubmit: () => void
}) {
  const body = innerWidth(width)
  const spec = group.spec?.spec
  const newest = group.deployed[0]
  const appId = selected?.appId ?? newest?.appId ?? group.optedIn[0]
  const creator = newest?.creator
  const creatorLabel =
    creator === undefined ? undefined : creator === sender ? `${accountName ?? shorten(creator, 16)} · this account` : creator
  const status = group.deployed.length > 0 ? 'DEPLOYED' : group.optedIn.length > 0 ? 'OPTED IN' : 'NOT DEPLOYED'
  const live = new Map((globalState ?? []).map((entry) => [entry.key, entry.value]))
  const keys = spec?.stateKeys
  const stateRows = keys
    ? (['global', 'local', 'box'] as const).flatMap((scope) =>
        Object.entries(keys[scope]).map(([name, info]) => {
          const value = scope === 'global' ? live.get(name) : undefined
          return { label: name, value: `${scope} · ${info.valueType}${value === undefined ? '' : ` = ${value}`}` }
        }),
      )
    : []
  const bare = spec?.bareActions
  const schema = spec?.schema
  const hasSchema = schema ? schema.globalInts + schema.globalBytes + schema.localInts + schema.localBytes > 0 : false
  const ids = (list: ReadonlyArray<{ appId: number } | number>) =>
    list.map((entry) => `#${typeof entry === 'number' ? entry : entry.appId}`).join(' · ')
  return (
    <box onMouseDown={selected ? undefined : onActivate}>
      <Frame width={width}>
        <Header
          kicker={`${index === undefined ? '' : `[${index}] `}${group.name.toUpperCase()}`}
          chip={spec?.format.toUpperCase()}
          pill={status === 'DEPLOYED' ? network.toUpperCase() : status}
          tone="idle"
          action={
            <>
              {onOpen ? <Button label="open ▸" onPress={onOpen} /> : null}
              <LiveDot live={status === 'DEPLOYED'} />
            </>
          }
        />
        {appId !== undefined ? <Hero value={`#${appId}`} copy={String(appId)} /> : null}
        <box marginTop={1} flexDirection="column">
          <Rule width={body} />
          {creatorLabel ? <Fact label="creator" value={creatorLabel} copy={creator} width={body} /> : null}
          {group.deployed.length > 1 ? (
            <Fact label="deploys" value={`${group.deployed.length} · ${ids(group.deployed)}`} width={body} />
          ) : null}
          {group.optedIn.length > 0 && status === 'DEPLOYED' ? (
            <Fact label="opted in" value={ids(group.optedIn)} width={body} />
          ) : null}
          {group.specs.map((file, i) => (
            <Fact key={file.path} label={i === 0 ? 'spec' : 'also'} value={file.path} width={body} />
          ))}
          {spec?.description ? <Fact label="about" value={spec.description} width={body} /> : null}
          {hasSchema && schema ? <Fact label="g-uint" value={String(schema.globalInts)} width={body} /> : null}
          {hasSchema && schema ? <Fact label="g-bytes" value={String(schema.globalBytes)} width={body} /> : null}
          {hasSchema && schema ? <Fact label="l-uint" value={String(schema.localInts)} width={body} /> : null}
          {hasSchema && schema ? <Fact label="l-bytes" value={String(schema.localBytes)} width={body} /> : null}
          {bare && (bare.create.length > 0 || bare.call.length > 0) ? (
            <Fact label="bare" value={`create ${bare.create.join('/') || '—'} · call ${bare.call.join('/') || '—'}`} width={body} />
          ) : null}
          {spec && spec.templateVariables.length > 0 ? (
            <Fact label="templates" value={spec.templateVariables.join(', ')} width={body} />
          ) : null}
          {stateRows.length > 0 ? (
            <>
              <Rule width={body} />
              {stateRows.map((row) => (
                <Fact key={row.label} label={row.label} value={row.value} width={body} />
              ))}
            </>
          ) : null}
          {spec ? (
            <>
              <Rule width={body} />
              {spec.methods.length === 0 ? (
                <text fg={COLORS.muted} content="No ABI methods declared." />
              ) : (
                spec.methods.slice(0, 9).map((method, i) => {
                  const open = selectedMethod?.signature === method.signature
                  const label = selected ? `[${i + 1}] ${method.signature}` : method.signature
                  return (
                    <box key={method.signature} flexDirection="column">
                      <box flexDirection="row" height={1} onMouseDown={selected ? () => onSelectMethod(method) : undefined}>
                        <text fg={open ? COLORS.brassBright : COLORS.text} content={shorten(label, body - 8)} />
                        <text fg={COLORS.faint} content={`  ${method.readonly ? 'read' : 'write'}`} />
                      </box>
                      {method.description ? (
                        <text fg={COLORS.faint} content={`    ${shorten(method.description, body - 4)}`} />
                      ) : null}
                      {open && selected ? <MethodCall selected={selected} method={method} width={body} {...call} /> : null}
                    </box>
                  )
                })
              )}
              {spec.methods.length > 9 ? <FooterNote text={`${spec.methods.length - 9} more methods`} width={body} /> : null}
              {selected && deployOpen ? (
                <box flexDirection="column" marginTop={1}>
                  <text fg={COLORS.brassBright} content={`deploy ${spec.name}`} />
                  <MethodCall selected={selected} method={deployMethod(spec)} width={body} deploy {...call} />
                </box>
              ) : null}
              {selected && !deployOpen && call.callBusy && !selectedMethod ? (
                <text fg={COLORS.muted} marginTop={1} content="Composing the deploy…" />
              ) : null}
              {selected && !deployOpen && call.callError && !selectedMethod ? (
                <text fg={COLORS.brassBright} marginTop={1} content={shorten(call.callError, body)} />
              ) : null}
              {selected ? (
                <FooterNote text="One call per review here. Groups and multi-step flows: ask the agent — it has these methods as tools." width={body} />
              ) : null}
            </>
          ) : (
            <FooterNote text="No local spec — open ▸ reads the program on-chain." width={body} />
          )}
        </box>
      </Frame>
    </box>
  )
}

/** My Apps: one card per contract, one page; the selected card lights up, numbers its methods, and takes calls inline. */
export function AppsScreen({
  network,
  groups,
  selected,
  selectedMethod,
  deployOpen,
  sender,
  accountName,
  deployedLoading,
  deployedError,
  optedInLoading,
  globalState,
  width,
  onActivate,
  onOpenApp,
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
  groups: ReadonlyArray<AppGroup>
  selected: SpecSelection | null
  selectedMethod: ParsedMethod | null
  deployOpen: boolean
  sender?: string
  accountName?: string
  deployedLoading: boolean
  deployedError: string | null
  optedInLoading: boolean
  globalState: AppStateEntry[] | null
  width: number
  onActivate: (index: number) => void
  /** Opens the selected app's record in the explore feed. */
  onOpenApp: () => void
  onSelectMethod: (method: ParsedMethod) => void
  callEpoch: number
  callBusy: boolean
  callError: string | null
  callResult: unknown
  onInput: (value: string) => void
  onSubmit: () => void
  inputRef?: RefObject<InputRenderable | null>
}) {
  const cardWidth = Math.max(30, width - 6)
  const call = { callEpoch, callBusy, callError, callResult, onInput, onSubmit, inputRef }
  const loading = deployedLoading || optedInLoading
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      padding={1}
      border
      borderStyle="heavy"
      borderColor={COLORS.brass}
      title={` MY APPS · ${network} · ${sender ? (accountName ?? shorten(sender, 16)) : 'no wallet'} `}
      titleColor={COLORS.brassBright}
      bottomTitle={` ${shorten(keys, Math.max(8, width - 6))} `}
      bottomTitleAlignment="right"
      backgroundColor={COLORS.background}
    >
      <scrollbox flexGrow={1} stickyScroll={false}>
        {groups.length === 0 ? (
          <text
            fg={COLORS.faint}
            marginTop={1}
            content={
              loading
                ? 'Detecting deployments…'
                : deployedError
                  ? deployedError
                  : `No apps yet. Deploy one, or put an ARC-56 spec under this directory${sender ? '' : ' — and pick a wallet with ^w for its opted-in apps'}.`
            }
          />
        ) : (
          <>
            {groups.map((group, i) => {
              const open = selected?.group.name === group.name ? selected : undefined
              return (
                <HighlightContext.Provider key={group.name} value={open !== undefined}>
                  <AppGroupCard
                    group={group}
                    sender={sender}
                    accountName={accountName}
                    index={i + 1}
                    selected={open}
                    selectedMethod={open ? selectedMethod : null}
                    deployOpen={open !== undefined && deployOpen}
                    globalState={open ? globalState : null}
                    network={network}
                    width={cardWidth}
                    onActivate={() => onActivate(i + 1)}
                    onSelectMethod={onSelectMethod}
                    onOpen={open && open.appId !== undefined ? onOpenApp : undefined}
                    {...call}
                  />
                </HighlightContext.Provider>
              )
            })}
            {loading ? <FooterNote text="Detecting deployments…" width={cardWidth} /> : null}
            {deployedError ? <text fg={COLORS.brassBright} marginTop={1} content={shorten(deployedError, cardWidth)} /> : null}
          </>
        )}
      </scrollbox>
    </box>
  )
}

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
