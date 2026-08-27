import type { InputRenderable, SubmitEvent as OpenTUISubmitEvent } from '@opentui/core'
import type { RefObject } from 'react'

import type { ParsedMethod } from '@initlabs/vibekit/tools'

import {
  Button,
  Fact,
  FooterNote,
  Frame,
  Header,
  Hero,
  HighlightContext,
  innerWidth,
  LiveDot,
  Rule,
} from '../../primitives.js'
import { COLORS, shorten } from '../../theme.js'
import { deployMethod, type AppGroup, type AppStateEntry, type SpecSelection } from './hooks.js'
import { methodPrompt } from './method-args.js'

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
    lines.push(
      `return: ${typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)}`,
    )
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
      <box
        height={3}
        flexDirection="row"
        alignItems="center"
        paddingX={1}
        border
        borderStyle="single"
        borderColor={COLORS.brass}
      >
        <text fg={COLORS.brassBright}>{`${methodPrompt(method)} ❯ `}</text>
        <input
          key={callEpoch}
          ref={inputRef}
          flexGrow={1}
          focused
          placeholder={
            deploy
              ? method.args.map((arg) => `${arg.name}=…`).join(' ')
              : method.args.length === 0
                ? readonly
                  ? 'enter to simulate'
                  : 'enter to compose'
                : example
          }
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
      {callBusy ? (
        <text fg={COLORS.muted} content={readonly && !deploy ? 'Simulating…' : 'Composing…'} />
      ) : null}
      {callError ? <text fg={COLORS.brassBright} content={shorten(callError, width - 4)} /> : null}
      {callResult !== null ? (
        <text fg={COLORS.text} content={formatCallResult(callResult)} />
      ) : null}
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
    creator === undefined
      ? undefined
      : creator === sender
        ? `${accountName ?? shorten(creator, 16)} · this account`
        : creator
  const status =
    group.deployed.length > 0 ? 'DEPLOYED' : group.optedIn.length > 0 ? 'OPTED IN' : 'NOT DEPLOYED'
  const live = new Map((globalState ?? []).map((entry) => [entry.key, entry.value]))
  const keys = spec?.stateKeys
  const stateRows = keys
    ? (['global', 'local', 'box'] as const).flatMap((scope) =>
        Object.entries(keys[scope]).map(([name, info]) => {
          const value = scope === 'global' ? live.get(name) : undefined
          return {
            label: name,
            value: `${scope} · ${info.valueType}${value === undefined ? '' : ` = ${value}`}`,
          }
        }),
      )
    : []
  const bare = spec?.bareActions
  const schema = spec?.schema
  const hasSchema = schema
    ? schema.globalInts + schema.globalBytes + schema.localInts + schema.localBytes > 0
    : false
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
          {creatorLabel ? (
            <Fact label="creator" value={creatorLabel} copy={creator} width={body} />
          ) : null}
          {group.deployed.length > 1 ? (
            <Fact
              label="deploys"
              value={`${group.deployed.length} · ${ids(group.deployed)}`}
              width={body}
            />
          ) : null}
          {group.optedIn.length > 0 && status === 'DEPLOYED' ? (
            <Fact label="opted in" value={ids(group.optedIn)} width={body} />
          ) : null}
          {group.specs.map((file, i) => (
            <Fact
              key={file.path}
              label={i === 0 ? 'spec' : 'also'}
              value={file.path}
              width={body}
            />
          ))}
          {spec?.description ? <Fact label="about" value={spec.description} width={body} /> : null}
          {hasSchema && schema ? (
            <Fact label="g-uint" value={String(schema.globalInts)} width={body} />
          ) : null}
          {hasSchema && schema ? (
            <Fact label="g-bytes" value={String(schema.globalBytes)} width={body} />
          ) : null}
          {hasSchema && schema ? (
            <Fact label="l-uint" value={String(schema.localInts)} width={body} />
          ) : null}
          {hasSchema && schema ? (
            <Fact label="l-bytes" value={String(schema.localBytes)} width={body} />
          ) : null}
          {bare && (bare.create.length > 0 || bare.call.length > 0) ? (
            <Fact
              label="bare"
              value={`create ${bare.create.join('/') || '—'} · call ${bare.call.join('/') || '—'}`}
              width={body}
            />
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
                      <box
                        flexDirection="row"
                        height={1}
                        onMouseDown={selected ? () => onSelectMethod(method) : undefined}
                      >
                        <text
                          fg={open ? COLORS.brassBright : COLORS.text}
                          content={shorten(label, body - 8)}
                        />
                        <text
                          fg={COLORS.faint}
                          content={`  ${method.readonly ? 'read' : 'write'}`}
                        />
                      </box>
                      {method.description ? (
                        <text
                          fg={COLORS.faint}
                          content={`    ${shorten(method.description, body - 4)}`}
                        />
                      ) : null}
                      {open && selected ? (
                        <MethodCall selected={selected} method={method} width={body} {...call} />
                      ) : null}
                    </box>
                  )
                })
              )}
              {spec.methods.length > 9 ? (
                <FooterNote text={`${spec.methods.length - 9} more methods`} width={body} />
              ) : null}
              {selected && deployOpen ? (
                <box flexDirection="column" marginTop={1}>
                  <text fg={COLORS.brassBright} content={`deploy ${spec.name}`} />
                  <MethodCall
                    selected={selected}
                    method={deployMethod(spec)}
                    width={body}
                    deploy
                    {...call}
                  />
                </box>
              ) : null}
              {selected && !deployOpen && call.callBusy && !selectedMethod ? (
                <text fg={COLORS.muted} marginTop={1} content="Composing the deploy…" />
              ) : null}
              {selected && !deployOpen && call.callError && !selectedMethod ? (
                <text
                  fg={COLORS.brassBright}
                  marginTop={1}
                  content={shorten(call.callError, body)}
                />
              ) : null}
              {selected ? (
                <FooterNote
                  text="One call per review here. Groups and multi-step flows: ask the agent — it has these methods as tools."
                  width={body}
                />
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
            {deployedError ? (
              <text
                fg={COLORS.brassBright}
                marginTop={1}
                content={shorten(deployedError, cardWidth)}
              />
            ) : null}
          </>
        )}
      </scrollbox>
    </box>
  )
}
