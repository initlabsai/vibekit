import { base64ToBytes } from '@initlabs/vibekit'
import type { MouseEvent } from '@opentui/core'
import {
  formatAssetAmount,
  formatBlockTxnType,
  formatExplorerTime,
  formatMicroAlgos,
  formatOnCompletion,
  transactionKind,
  type TransactionDetailViewModel,
  type TransactionRowData,
} from '@initlabs/vibekit-explorer'

import { COLORS, shorten } from '../../theme.js'
import {
  Button,
  Chip,
  Fact,
  FooterNote,
  Frame,
  Header,
  Hero,
  innerWidth,
  Rule,
  Unavailable,
  type Tone,
} from '../../primitives.js'
import { algo, bytesDisplay, MoreFooter, pad } from '../../generic-cards.js'

const MAX_DELTAS = 6

/** ARC-4 return logs start with 0x151f7c75. */
const ARC4_RETURN_PREFIX = 'FR98dQ'

/**
 * An ARC-4 return log whose payload is an ABI `string` (2-byte length prefix
 * matching the remainder) shows as text; anything else stays base64 —
 * without the spec there is no honest decode.
 */
function returnDisplay(log: string): string {
  try {
    const bytes = base64ToBytes(log).slice(4)
    if (bytes.length >= 2) {
      const length = (bytes[0]! << 8) | bytes[1]!
      if (length === bytes.length - 2) {
        const text = new TextDecoder().decode(bytes.slice(2))
        if (/^[^\p{C}]*$/u.test(text)) return `"${text}"`
      }
    }
  } catch {
    /* fall through to base64 */
  }
  return log
}

function stateValue(value: { action: number; bytes?: string; uint?: number | string }): string {
  if (value.action === 3) return 'deleted'
  if (value.uint !== undefined) return String(value.uint)
  return value.bytes === undefined ? '—' : bytesDisplay(value.bytes)
}

function formatAbiValue(value: unknown): string {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

type FactRow = { label: string; value: string; copy?: string; color?: string }

/** The detail card's rows, in reading order; absent fields produce no row. */
function detailFacts(model: TransactionDetailViewModel): FactRow[] {
  const id = (value: number | string | undefined, label: string) =>
    value === undefined ? undefined : { label, value: String(value), copy: String(value) }
  const address = (value: string | undefined, label: string) =>
    value ? { label, value, copy: value } : undefined
  // A pool bootstrap writes a dozen keys; the card shows the first few, the count says the rest.
  const deltas = [
    ...(model.globalStateDelta ?? []).map((entry) => ({
      label: 'Δ global',
      value: `${bytesDisplay(entry.key)} = ${stateValue(entry.value)}`,
    })),
    ...(model.localStateDelta ?? []).flatMap((local) =>
      local.delta.map((entry) => ({
        label: 'Δ local',
        value: `${local.address.slice(0, 8)}… ${bytesDisplay(entry.key)} = ${stateValue(entry.value)}`,
      })),
    ),
  ]
  const rows: Array<FactRow | undefined> = [
    { label: 'id', value: model.id, copy: model.id },
    model.roundTime === undefined
      ? undefined
      : { label: 'time', value: formatExplorerTime(model.roundTime) },
    id(model.confirmedRound, 'block'),
    { label: 'fee', value: algo(model.feeMicroAlgos) },
    address(model.sender, 'from'),
    address(model.clawbackFrom, 'clawback'),
    address(model.receiver, 'to'),
    model.assetId === undefined
      ? undefined
      : { label: 'asset', value: assetLabel(model), copy: String(model.assetId) },
    id(model.applicationId, 'app'),
    model.methodName ? { label: 'method', value: model.methodName } : undefined,
    ...(model.methodArgs ?? []).map((arg) => ({
      label: arg.name ?? arg.type,
      value: formatAbiValue(arg.value),
    })),
    model.methodReturn === undefined
      ? undefined
      : { label: 'return', value: formatAbiValue(model.methodReturn) },
    // Raw args and logs only when no spec decoded them.
    ...(model.methodName
      ? []
      : (model.applicationArgs ?? []).map((arg, index) => ({
          label: `arg ${index}`,
          value: bytesDisplay(arg),
        }))),
    ...(model.methodReturn !== undefined
      ? []
      : (model.logs ?? []).map((log, index) =>
          log.startsWith(ARC4_RETURN_PREFIX)
            ? { label: 'return', value: returnDisplay(log) }
            : { label: `log ${index}`, value: bytesDisplay(log) },
        )),
    ...deltas.slice(0, MAX_DELTAS),
    deltas.length > MAX_DELTAS
      ? {
          label: 'Δ …',
          value: `${deltas.length - MAX_DELTAS} more state changes`,
          color: COLORS.faint,
        }
      : undefined,
    model.onCompletion
      ? { label: 'on-comp', value: formatOnCompletion(model.onCompletion) }
      : undefined,
    address(model.closeTo, 'close'),
    model.closeTo === undefined || model.closeAmountMicroAlgos === undefined
      ? undefined
      : { label: 'closed', value: algo(model.closeAmountMicroAlgos) },
    model.closeTo === undefined || model.closeAssetAmount === undefined
      ? undefined
      : {
          label: 'closed',
          value: formatAssetAmount(
            model.closeAssetAmount,
            model.assetDecimals,
            model.assetUnitName,
          ),
        },
    address(model.rekeyTo, 'rekey'),
    address(model.group, 'group'),
    model.innerCount ? { label: 'inner', value: `+${model.innerCount}` } : undefined,
    model.note ? { label: 'note', value: model.note } : undefined,
    { label: 'network', value: model.network },
  ]
  return rows.filter((row): row is FactRow => row !== undefined)
}

/** The asset behind an amount, the way every card says it: id · name. */
function assetLabel(row: { assetId?: number | string; assetName?: string }): string {
  return row.assetName ? `${row.assetId} · ${row.assetName}` : String(row.assetId)
}

export function TransactionCard({
  model,
  width,
}: {
  model: TransactionDetailViewModel | undefined
  width: number
}) {
  if (!model) return <Unavailable title="TRANSACTION" width={width} />
  const body = innerWidth(width)
  const hero =
    model.paymentAmountMicroAlgos !== undefined
      ? { value: formatMicroAlgos(model.paymentAmountMicroAlgos), unit: 'ALGO' }
      : model.assetAmount !== undefined
        ? {
            value: formatAssetAmount(model.assetAmount, model.assetDecimals),
            unit: model.assetUnitName,
          }
        : undefined
  const tone: Tone =
    model.status === 'confirmed' ? 'ok' : model.status === 'failed' ? 'bad' : 'warn'
  return (
    <Frame width={width}>
      <Header
        kicker="TRANSACTION"
        chip={formatBlockTxnType(model.type)}
        pill={model.status.toUpperCase()}
        tone={tone}
      />
      {hero ? <Hero value={hero.value} unit={hero.unit} /> : null}
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        {detailFacts(model).map((row, index) => (
          <Fact
            key={`${row.label}-${index}`}
            label={row.label}
            value={row.value}
            copy={row.copy}
            valueColor={row.color}
            width={body}
          />
        ))}
      </box>
    </Frame>
  )
}

function queryLabel(
  query: {
    txType?: string
    assetId?: number
    applicationId?: number
    minRound?: number
    maxRound?: number
    notePrefix?: string
  },
  unitFor: (assetId: number) => string | undefined = () => undefined,
): string | undefined {
  const parts = [
    query.txType ? formatBlockTxnType(query.txType) : undefined,
    query.assetId === undefined ? undefined : (unitFor(query.assetId) ?? `asset ${query.assetId}`),
    query.applicationId === undefined ? undefined : `app ${query.applicationId}`,
    query.minRound !== undefined &&
    query.maxRound !== undefined &&
    query.minRound === query.maxRound
      ? `round ${query.minRound}`
      : [
          query.minRound === undefined ? undefined : `≥ ${query.minRound}`,
          query.maxRound === undefined ? undefined : `≤ ${query.maxRound}`,
        ]
          .filter(Boolean)
          .join(' ') || undefined,
    query.notePrefix ? `note "${query.notePrefix}"` : undefined,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

function compactTime(roundTime: number): string {
  return new Date(roundTime * 1000).toISOString().slice(11, 16)
}

/** The row's kind as the graph names it: creates say so, not "Application Call" / "Asset Config". */
function rowType(row: TransactionRowData): string {
  const kind = transactionKind(row)
  if (kind === 'appCreate') return 'Application Create'
  if (kind === 'assetCreate') return 'Asset Create'
  return formatBlockTxnType(row.type ?? 'txn')
}

/** Rows with their inner transactions flattened beneath them, depth-first, as the graph draws them. */
function withInners(
  rows: ReadonlyArray<TransactionRowData>,
  depth = 0,
): Array<{ row: TransactionRowData; depth: number; index: number }> {
  return rows.flatMap((row, index) => [
    { row, depth, index },
    ...withInners(row.innerTxns ?? [], depth + 1),
  ])
}

function assetFact(row: TransactionRowData): string | undefined {
  return row.assetId === undefined ? undefined : assetLabel(row)
}

function rowAmount(row: TransactionRowData): string | undefined {
  const kind = transactionKind(row)
  if (kind === 'rekey') return 'rekey'
  if (kind === 'assetOptIn')
    return `opt-in ${row.assetUnitName ?? (row.assetId === undefined ? '' : `#${row.assetId}`)}`.trim()
  if (row.paymentAmountMicroAlgos !== undefined) return algo(row.paymentAmountMicroAlgos)
  if (row.assetAmount === undefined) return undefined
  const value = formatAssetAmount(row.assetAmount, row.assetDecimals, row.assetUnitName)
  return row.assetUnitName || row.assetId === undefined ? value : `${value} #${row.assetId}`
}

function rowCounterparty(row: TransactionRowData): string | undefined {
  return row.receiver ?? (row.applicationId === undefined ? undefined : `app ${row.applicationId}`)
}

/**
 * One line per transaction: number · type · amount · from → to · round · time.
 * The number is the keyboard path (1-9 opens that row in the selected
 * section); the whole line is the mouse path.
 */
function TransactionTable({
  rows,
  innerType,
  body,
  onOpen,
}: {
  rows: ReadonlyArray<TransactionRowData>
  innerType?: string
  body: number
  onOpen?: (txid: string) => void
}) {
  const numW = 3
  // Wide enough for "Application Call" and a nested "└ Asset Transfer".
  const typeW = 18
  const amountW = 18
  const roundW = 9
  const timeW = 5
  const partyW = Math.max(12, body - (numW + typeW + amountW + roundW + timeW + 5))
  const each = Math.max(4, Math.floor((partyW - 3) / 2))
  const header = [
    pad('#', numW),
    pad('type', typeW),
    pad('amount', amountW, 'right'),
    pad('from → to', partyW),
    pad('round', roundW, 'right'),
    pad('UTC', timeW),
  ].join(' ')
  return (
    <box flexDirection="column" marginTop={1}>
      <text fg={COLORS.faint} content={header} />
      {withInners(rows).map(({ row, depth, index }, at) => {
        const matchedViaInner =
          innerType !== undefined && row.type !== undefined && row.type !== innerType
        const nest = depth === 0 ? '' : `${'  '.repeat(depth - 1)}└ `
        const type = `${nest}${rowType(row)}${matchedViaInner ? '*' : ''}`
        const to = rowCounterparty(row)
        const party = to
          ? `${shorten(row.sender, each)} → ${shorten(to, each)}`
          : shorten(row.sender, partyW)
        const line = [
          pad(depth === 0 && index < 9 ? `[${index + 1}]` : '', numW),
          pad(type, typeW),
          pad(rowAmount(row) ?? '', amountW, 'right'),
          pad(party, partyW),
          pad(row.confirmedRound === undefined ? '' : String(row.confirmedRound), roundW, 'right'),
          pad(row.roundTime === undefined ? '' : compactTime(row.roundTime), timeW),
        ].join(' ')
        return (
          <text
            key={row.id ?? `${row.sender}-${at}`}
            fg={onOpen && row.id ? COLORS.text : COLORS.muted}
            content={line}
            onMouseDown={
              onOpen && row.id
                ? (event: MouseEvent) => {
                    event.stopPropagation()
                    onOpen(row.id!)
                  }
                : undefined
            }
          />
        )
      })}
      {innerType && rows.some((row) => row.type !== undefined && row.type !== innerType) ? (
        <text
          fg={COLORS.faint}
          content={`* matched through inner ${formatBlockTxnType(innerType)} txns`}
        />
      ) : null}
    </box>
  )
}

/** Inner transactions under their parent: indented, the few facts an inner has, recursive. */
function InnerRows({
  rows,
  depth,
  body,
}: {
  rows: ReadonlyArray<TransactionRowData>
  depth: number
  body: number
}) {
  if (rows.length === 0) return null
  const indent = depth * 2
  const width = Math.max(8, body - indent)
  return (
    <box flexDirection="column" marginLeft={indent}>
      {rows.map((row, index) => {
        const amount = rowAmount(row)
        const to = rowCounterparty(row)
        return (
          <box key={`${row.sender}-${index}`} flexDirection="column" marginTop={1}>
            <box flexDirection="row" height={1}>
              <text fg={COLORS.faint}>{'└ '}</text>
              <Chip label={rowType(row)} />
              {amount ? <text fg={COLORS.brassBright}>{`  ${amount}`}</text> : null}
            </box>
            <Fact label="from" value={row.sender} copy={row.sender} width={width} />
            {to ? (
              <Fact
                label="to"
                value={to}
                copy={
                  row.receiver ??
                  (row.applicationId === undefined ? undefined : String(row.applicationId))
                }
                width={width}
              />
            ) : null}
            {assetFact(row) ? (
              <Fact
                label="asset"
                value={assetFact(row)!}
                copy={String(row.assetId)}
                width={width}
              />
            ) : null}
            <InnerRows rows={row.innerTxns ?? []} depth={depth + 1} body={body} />
          </box>
        )
      })}
    </box>
  )
}

export function TransactionListCard({
  title,
  groupId,
  transactions,
  nextToken,
  query,
  width,
  onOpen,
  onShowGraph,
  onMore,
  loadingMore = false,
  layout = 'stack',
  onToggleLayout,
}: {
  title: string
  groupId?: string
  transactions: ReadonlyArray<TransactionRowData>
  nextToken?: string
  query?: Parameters<typeof queryLabel>[0]
  width: number
  /** Opens one row's detail card; rows grow an open button when provided. */
  onOpen?: (txid: string) => void
  /** Group tables: switch this card back to its flow graph. */
  onShowGraph?: () => void
  /** Fetches the next page into this card; present only when there is one. */
  onMore?: () => void
  loadingMore?: boolean
  /** stack: a fact block per row (default); table: one line per row. */
  layout?: 'stack' | 'table'
  onToggleLayout?: () => void
}) {
  const body = innerWidth(width)
  // Every row the record holds renders: pages merge into this card, so no display cap.
  const unitFor = (assetId: number) =>
    transactions.find((row) => Number(row.assetId) === assetId && row.assetUnitName)?.assetUnitName
  const filter = query ? queryLabel(query, unitFor) : undefined
  // The indexer's type filter also matches inner txns and returns the root,
  // so a row of another type is an app call that matched through its inners.
  const innerType = query?.txType
  const viaInner = innerType
    ? transactions.filter((row) => row.type !== undefined && row.type !== innerType).length
    : 0
  return (
    <Frame width={width}>
      <Header
        kicker={title}
        chip={filter}
        pill={String(transactions.length)}
        tone="idle"
        action={
          <>
            {onToggleLayout ? (
              <Button label={layout === 'table' ? 'expand' : 'compact'} onPress={onToggleLayout} />
            ) : null}
            {onShowGraph ? <Button label="graph" onPress={onShowGraph} /> : null}
          </>
        }
      />
      {groupId ? <Fact label="group" value={groupId} copy={groupId} width={body} /> : null}
      {layout === 'table' ? (
        <TransactionTable rows={transactions} innerType={innerType} body={body} onOpen={onOpen} />
      ) : null}
      <box flexDirection="column">
        {(layout === 'table' ? [] : transactions).map((row, index) => {
          const amount = rowAmount(row)
          const to = rowCounterparty(row)
          return (
            <box key={row.id ?? `${row.sender}-${index}`} flexDirection="column" marginTop={1}>
              <box flexDirection="row" height={1} justifyContent="space-between">
                <box flexDirection="row">
                  <Chip
                    label={
                      innerType && row.type !== undefined && row.type !== innerType
                        ? `${rowType(row)} · inner ${formatBlockTxnType(innerType)}`
                        : rowType(row)
                    }
                  />
                  {amount ? <text fg={COLORS.brassBright}>{`  ${amount}`}</text> : null}
                </box>
                {onOpen && row.id ? (
                  <Button label="open ▸" onPress={() => onOpen(row.id!)} />
                ) : null}
              </box>
              <Fact label="from" value={row.sender} copy={row.sender} width={body} />
              {to ? (
                <Fact
                  label="to"
                  value={to}
                  copy={
                    row.receiver ??
                    (row.applicationId === undefined ? undefined : String(row.applicationId))
                  }
                  width={body}
                />
              ) : null}
              {row.id ? <Fact label="id" value={row.id} copy={row.id} width={body} /> : null}
              {row.confirmedRound === undefined ? null : (
                <Fact
                  label="round"
                  value={String(row.confirmedRound)}
                  copy={String(row.confirmedRound)}
                  width={body}
                />
              )}
              {row.roundTime === undefined ? null : (
                <Fact label="time" value={formatExplorerTime(row.roundTime)} width={body} />
              )}
              {row.feeMicroAlgos === undefined ? null : (
                <Fact label="fee" value={algo(row.feeMicroAlgos)} width={body} />
              )}
              {assetFact(row) ? (
                <Fact
                  label="asset"
                  value={assetFact(row)!}
                  copy={String(row.assetId)}
                  width={body}
                />
              ) : null}
              <InnerRows rows={row.innerTxns ?? []} depth={1} body={body} />
              {index < transactions.length - 1 ? <Rule width={body} /> : null}
            </box>
          )
        })}
        {viaInner > 0 && innerType ? (
          <FooterNote
            text={`${viaInner} app call${viaInner === 1 ? '' : 's'} matched through inner ${formatBlockTxnType(innerType)} txns`}
            width={body}
          />
        ) : null}
        <MoreFooter
          count={transactions.length}
          nextToken={nextToken}
          onMore={onMore}
          loadingMore={loadingMore}
          width={body}
        />
      </box>
    </Frame>
  )
}
