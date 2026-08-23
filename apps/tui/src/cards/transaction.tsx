import { base64ToBytes } from '@initlabs/vibekit-core'
import type { MouseEvent } from '@opentui/core'
import {
  formatBaseUnits,
  formatBlockTxnType,
  formatExplorerTime,
  formatMicroAlgos,
  formatOnCompletion,
  type TransactionDetailViewModel,
} from '@initlabs/vibekit-explorer'

import { COLORS, shorten } from '../theme.js'
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
} from '../ui.js'
import { algo, bytesDisplay, pageNotes } from './shared.js'

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
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function assetUnits(
  amount: number | string | undefined,
  decimals?: number,
  unitName?: string,
): { value: string; unit?: string } | undefined {
  if (amount === undefined) return undefined
  const value = decimals === undefined ? String(amount) : formatBaseUnits(amount, decimals)
  return { value, unit: unitName }
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
  const payment = model.amountMicroAlgos === undefined
    ? undefined
    : { value: formatMicroAlgos(model.amountMicroAlgos), unit: 'ALGO' }
  const transfer = assetUnits(model.assetAmount, model.assetDecimals, model.assetUnitName)
  const hero = payment ?? transfer
  const tone: Tone = model.status === 'confirmed' ? 'ok' : model.status === 'failed' ? 'bad' : 'warn'
  const assetLabel =
    model.assetId === undefined
      ? undefined
      : model.assetName
        ? `${model.assetId} · ${model.assetName}`
        : String(model.assetId)
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
        <Fact label="id" value={model.id} copy={model.id} width={body} />
        {model.roundTime === undefined ? null : (
          <Fact label="time" value={formatExplorerTime(model.roundTime)} width={body} />
        )}
        {model.confirmedRound === undefined ? null : (
          <Fact
            label="block"
            value={String(model.confirmedRound)}
            copy={String(model.confirmedRound)}
            width={body}
          />
        )}
        <Fact label="fee" value={algo(model.feeMicroAlgos) ?? '—'} width={body} />
        <Fact label="from" value={model.sender} copy={model.sender} width={body} />
        {model.clawbackFrom ? (
          <Fact label="clawback" value={model.clawbackFrom} copy={model.clawbackFrom} width={body} />
        ) : null}
        {model.receiver ? (
          <Fact label="to" value={model.receiver} copy={model.receiver} width={body} />
        ) : null}
        {assetLabel && model.assetId !== undefined ? (
          <Fact label="asset" value={assetLabel} copy={String(model.assetId)} width={body} />
        ) : null}
        {model.applicationId === undefined ? null : (
          <Fact
            label="app"
            value={String(model.applicationId)}
            copy={String(model.applicationId)}
            width={body}
          />
        )}
        {model.methodName ? <Fact label="method" value={model.methodName} width={body} /> : null}
        {(model.methodArgs ?? []).map((arg, index) => (
          <Fact
            key={`${arg.name ?? arg.type}-${index}`}
            label={arg.name ?? arg.type}
            value={formatAbiValue(arg.value)}
            width={body}
          />
        ))}
        {model.methodReturn === undefined ? null : (
          <Fact label="return" value={formatAbiValue(model.methodReturn)} width={body} />
        )}
        {model.methodName
          ? null
          : (model.applicationArgs ?? []).map((arg, index) => (
              <Fact key={`arg-${index}`} label={`arg ${index}`} value={bytesDisplay(arg)} width={body} />
            ))}
        {model.methodReturn !== undefined
          ? null
          : (model.logs ?? []).map((log, index) =>
              log.startsWith(ARC4_RETURN_PREFIX) ? (
                <Fact key={`log-${index}`} label="return" value={returnDisplay(log)} width={body} />
              ) : (
                <Fact key={`log-${index}`} label={`log ${index}`} value={bytesDisplay(log)} width={body} />
              ),
            )}
        {(model.globalStateDelta ?? []).map((entry, index) => (
          <Fact
            key={`gd-${index}`}
            label="Δ global"
            value={`${bytesDisplay(entry.key)} = ${stateValue(entry.value)}`}
            width={body}
          />
        ))}
        {(model.localStateDelta ?? []).flatMap((local) =>
          local.delta.map((entry, index) => (
            <Fact
              key={`ld-${local.address}-${index}`}
              label="Δ local"
              value={`${local.address.slice(0, 8)}… ${bytesDisplay(entry.key)} = ${stateValue(entry.value)}`}
              width={body}
            />
          )),
        )}
        {model.onCompletion ? (
          <Fact label="on-comp" value={formatOnCompletion(model.onCompletion)} width={body} />
        ) : null}
        {model.closeTo ? (
          <Fact label="close" value={model.closeTo} copy={model.closeTo} width={body} />
        ) : null}
        {model.closeAmountMicroAlgos === undefined ? null : (
          <Fact label="closed" value={algo(model.closeAmountMicroAlgos) ?? '—'} width={body} />
        )}
        {model.closeAssetAmount === undefined ? null : (
          <Fact
            label="closed"
            value={
              assetUnits(model.closeAssetAmount, model.assetDecimals, model.assetUnitName)?.value ??
              String(model.closeAssetAmount)
            }
            width={body}
          />
        )}
        {model.rekeyTo ? (
          <Fact label="rekey" value={model.rekeyTo} copy={model.rekeyTo} width={body} />
        ) : null}
        {model.group ? (
          <Fact label="group" value={model.group} copy={model.group} width={body} />
        ) : null}
        {model.innerCount ? <Fact label="inner" value={`+${model.innerCount}`} width={body} /> : null}
        {model.note ? <Fact label="note" value={model.note} width={body} /> : null}
        <Fact label="network" value={model.network} width={body} />
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
    query.minRound !== undefined && query.maxRound !== undefined && query.minRound === query.maxRound
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

function pad(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  const cut = shorten(text, width)
  return align === 'right' ? cut.padStart(width) : cut.padEnd(width)
}

type ListRow = {
  id?: string
  type?: string
  sender: string
  receiver?: string
  paymentAmountMicroAlgos?: number | string
  feeMicroAlgos?: number | string
  assetId?: number | string
  assetAmount?: number | string
  assetUnitName?: string
  assetDecimals?: number
  applicationId?: number | string
  confirmedRound?: number
  roundTime?: number
  innerCount?: number
}

function rowAmount(row: ListRow): string | undefined {
  const payment = algo(row.paymentAmountMicroAlgos)
  if (payment) return payment
  if (row.assetAmount === undefined) return undefined
  const units = assetUnits(row.assetAmount, row.assetDecimals, row.assetUnitName)
  if (!units) return undefined
  return units.unit
    ? `${units.value} ${units.unit}`
    : `${units.value}${row.assetId === undefined ? '' : ` #${row.assetId}`}`
}

function rowCounterparty(row: ListRow): string | undefined {
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
  rows: ReadonlyArray<ListRow>
  innerType?: string
  body: number
  onOpen?: (txid: string) => void
}) {
  const numW = 3
  const typeW = 14
  const amountW = 14
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
      {rows.map((row, index) => {
        const matchedViaInner = innerType !== undefined && row.type !== undefined && row.type !== innerType
        const type = `${formatBlockTxnType(row.type ?? 'txn')}${matchedViaInner ? '*' : ''}`
        const to = rowCounterparty(row)
        const party = to ? `${shorten(row.sender, each)} → ${shorten(to, each)}` : shorten(row.sender, partyW)
        const line = [
          pad(index < 9 ? `[${index + 1}]` : '', numW),
          pad(type, typeW),
          pad(rowAmount(row) ?? '', amountW, 'right'),
          pad(party, partyW),
          pad(row.confirmedRound === undefined ? '' : String(row.confirmedRound), roundW, 'right'),
          pad(row.roundTime === undefined ? '' : compactTime(row.roundTime), timeW),
        ].join(' ')
        return (
          <text
            key={row.id ?? `${row.sender}-${index}`}
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
        <text fg={COLORS.faint} content={`* matched through inner ${formatBlockTxnType(innerType)} txns`} />
      ) : null}
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
  transactions: ReadonlyArray<ListRow>
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
  // Every row the record holds: pages merge into this card, so no display cap.
  const rows = transactions
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
        <TransactionTable rows={rows} innerType={innerType} body={body} onOpen={onOpen} />
      ) : null}
      <box flexDirection="column">
        {(layout === 'table' ? [] : rows).map((row, index) => {
          const amount = rowAmount(row)
          const to = rowCounterparty(row)
          return (
            <box key={row.id ?? `${row.sender}-${index}`} flexDirection="column" marginTop={1}>
              <box flexDirection="row" height={1} justifyContent="space-between">
                <box flexDirection="row">
                  <Chip
                    label={
                      innerType && row.type !== undefined && row.type !== innerType
                        ? `${formatBlockTxnType(row.type)} · inner ${formatBlockTxnType(innerType)}`
                        : formatBlockTxnType(row.type ?? 'txn')
                    }
                  />
                  {amount ? <text fg={COLORS.brassBright}>{`  ${amount}`}</text> : null}
                </box>
                {onOpen && row.id ? <Button label="open ▸" onPress={() => onOpen(row.id!)} /> : null}
              </box>
              <Fact label="from" value={row.sender} copy={row.sender} width={body} />
              {to ? (
                <Fact
                  label="to"
                  value={to}
                  copy={row.receiver ?? (row.applicationId === undefined ? undefined : String(row.applicationId))}
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
                <Fact label="fee" value={algo(row.feeMicroAlgos) ?? '—'} width={body} />
              )}
              {row.innerCount ? (
                <Fact label="inner" value={`+${row.innerCount}`} width={body} />
              ) : null}
              {index < rows.length - 1 ? <Rule width={body} /> : null}
            </box>
          )
        })}
        {viaInner > 0 && innerType ? (
          <FooterNote
            text={`${viaInner} app call${viaInner === 1 ? '' : 's'} matched through inner ${formatBlockTxnType(innerType)} txns`}
            width={body}
          />
        ) : null}
        {onMore ? (
          <box flexDirection="row" marginTop={1} height={1} gap={2}>
            <Button label={loadingMore ? 'loading…' : 'more ▸'} onPress={loadingMore ? () => {} : onMore} />
            <text fg={COLORS.faint}>{`${transactions.length} so far`}</text>
          </box>
        ) : (
          pageNotes(transactions.length, rows.length, nextToken).map((note) => (
            <FooterNote key={note} text={note} width={body} />
          ))
        )}
      </box>
    </Frame>
  )
}
