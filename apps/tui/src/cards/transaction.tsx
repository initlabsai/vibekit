import { base64ToBytes } from '@initlabs/vibekit-core'
import {
  formatBaseUnits,
  formatBlockTxnType,
  formatExplorerTime,
  formatMicroAlgos,
  formatOnCompletion,
  type TransactionDetailViewModel,
} from '@initlabs/vibekit-experience'

import { COLORS } from '../theme.js'
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
    minRound?: number
    maxRound?: number
    notePrefix?: string
  },
  unitFor: (assetId: number) => string | undefined = () => undefined,
): string | undefined {
  const parts = [
    query.txType ? formatBlockTxnType(query.txType) : undefined,
    query.assetId === undefined ? undefined : (unitFor(query.assetId) ?? `asset ${query.assetId}`),
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

export function TransactionListCard({
  title,
  groupId,
  transactions,
  nextToken,
  query,
  width,
  onOpen,
  onShowGraph,
}: {
  title: string
  groupId?: string
  transactions: ReadonlyArray<{
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
  }>
  nextToken?: string
  query?: Parameters<typeof queryLabel>[0]
  width: number
  /** Opens one row's detail card; rows grow an open button when provided. */
  onOpen?: (txid: string) => void
  /** Group tables: switch this card back to its flow graph. */
  onShowGraph?: () => void
}) {
  const body = innerWidth(width)
  const rows = transactions.slice(0, 10)
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
        action={onShowGraph ? <Button label="graph" onPress={onShowGraph} /> : undefined}
      />
      {groupId ? <Fact label="group" value={groupId} copy={groupId} width={body} /> : null}
      <box flexDirection="column">
        {rows.map((row, index) => {
          const payment = algo(row.paymentAmountMicroAlgos)
          const units =
            row.assetAmount === undefined
              ? undefined
              : assetUnits(row.assetAmount, row.assetDecimals, row.assetUnitName)
          const asset = units
            ? units.unit
              ? `${units.value} ${units.unit}`
              : `${units.value}${row.assetId === undefined ? '' : ` #${row.assetId}`}`
            : undefined
          const amount = payment ?? asset
          const to =
            row.receiver ??
            (row.applicationId === undefined ? undefined : `app ${row.applicationId}`)
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
        {pageNotes(transactions.length, rows.length, nextToken).map((note) => (
          <FooterNote key={note} text={note} width={body} />
        ))}
      </box>
    </Frame>
  )
}
