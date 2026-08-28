'use client'

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

import { algo, bytesDisplay, MoreFooter, Table, type Column } from '../../generic-cards'
import { Button, Copyable, Fact, Facts, FooterNote, Frame, Header, Hero, Unavailable, type Tone } from '../../primitives'
import { shorten } from '../../theme'

const MAX_DELTAS = 6
/** ARC-4 return logs start with 0x151f7c75. */
const ARC4_RETURN_PREFIX = 'FR98dQ'

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

function assetLabel(row: { assetId?: number | string; assetName?: string }): string {
  return row.assetName ? `${row.assetId} · ${row.assetName}` : String(row.assetId)
}

type FactRow = { label: string; value: string; copy?: string; faint?: boolean }

/** The detail card's rows, in reading order; absent fields produce no row. */
function detailFacts(model: TransactionDetailViewModel): FactRow[] {
  const id = (value: number | string | undefined, label: string) =>
    value === undefined ? undefined : { label, value: String(value), copy: String(value) }
  const address = (value: string | undefined, label: string) => (value ? { label, value, copy: value } : undefined)
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
    model.roundTime === undefined ? undefined : { label: 'time', value: formatExplorerTime(model.roundTime) },
    id(model.confirmedRound, 'block'),
    { label: 'fee', value: algo(model.feeMicroAlgos) },
    address(model.sender, 'from'),
    address(model.clawbackFrom, 'clawback'),
    address(model.receiver, 'to'),
    model.assetId === undefined ? undefined : { label: 'asset', value: assetLabel(model), copy: String(model.assetId) },
    id(model.applicationId, 'app'),
    model.methodName ? { label: 'method', value: model.methodName } : undefined,
    ...(model.methodArgs ?? []).map((arg) => ({ label: arg.name ?? arg.type, value: formatAbiValue(arg.value) })),
    model.methodReturn === undefined ? undefined : { label: 'return', value: formatAbiValue(model.methodReturn) },
    ...(model.methodName
      ? []
      : (model.applicationArgs ?? []).map((arg, index) => ({ label: `arg ${index}`, value: bytesDisplay(arg) }))),
    ...(model.methodReturn !== undefined
      ? []
      : (model.logs ?? []).map((log, index) =>
          log.startsWith(ARC4_RETURN_PREFIX)
            ? { label: 'return', value: log }
            : { label: `log ${index}`, value: bytesDisplay(log) },
        )),
    ...deltas.slice(0, MAX_DELTAS),
    deltas.length > MAX_DELTAS
      ? { label: 'Δ …', value: `${deltas.length - MAX_DELTAS} more state changes`, faint: true }
      : undefined,
    model.onCompletion ? { label: 'on-comp', value: formatOnCompletion(model.onCompletion) } : undefined,
    address(model.closeTo, 'close'),
    model.closeTo === undefined || model.closeAmountMicroAlgos === undefined
      ? undefined
      : { label: 'closed', value: algo(model.closeAmountMicroAlgos) },
    model.closeTo === undefined || model.closeAssetAmount === undefined
      ? undefined
      : { label: 'closed', value: formatAssetAmount(model.closeAssetAmount, model.assetDecimals, model.assetUnitName) },
    address(model.rekeyTo, 'rekey'),
    address(model.group, 'group'),
    model.innerCount ? { label: 'inner', value: `+${model.innerCount}` } : undefined,
    model.note ? { label: 'note', value: model.note } : undefined,
    { label: 'network', value: model.network },
  ]
  return rows.filter((row): row is FactRow => row !== undefined)
}

export function TransactionCard({
  model,
  onOpen,
}: {
  model: TransactionDetailViewModel | undefined
  onOpen?: (target: { kind: 'account'; address: string } | { kind: 'transactions'; filter: { address: string } }) => void
}) {
  if (!model) return <Unavailable title="TRANSACTION" />
  const hero =
    model.paymentAmountMicroAlgos !== undefined
      ? { value: formatMicroAlgos(model.paymentAmountMicroAlgos), unit: 'ALGO' }
      : model.assetAmount !== undefined
        ? { value: formatAssetAmount(model.assetAmount, model.assetDecimals), unit: model.assetUnitName }
        : undefined
  const tone: Tone = model.status === 'confirmed' ? 'ok' : model.status === 'failed' ? 'bad' : 'warn'
  return (
    <Frame>
      <Header kicker="TRANSACTION" chip={formatBlockTxnType(model.type)} pill={model.status.toUpperCase()} tone={tone} />
      {hero ? <Hero value={hero.value} unit={hero.unit} /> : null}
      <Facts>
        {detailFacts(model).map((row, index) => (
          <Fact key={`${row.label}-${index}`} label={row.label}>
            {row.copy ? <Copyable value={row.copy} display={row.value} /> : <span className={row.faint ? 'muted' : undefined}>{row.value}</span>}
            {onOpen && (row.label === 'from' || row.label === 'to') && row.copy && row.copy.length === 58 ? (
              <>
                {' '}
                <Button label="open" onPress={() => onOpen({ kind: 'account', address: row.copy! })} />
              </>
            ) : null}
          </Fact>
        ))}
      </Facts>
    </Frame>
  )
}

function queryLabel(query: {
  txType?: string
  assetId?: number
  applicationId?: number
  minRound?: number
  maxRound?: number
  notePrefix?: string
}): string | undefined {
  const parts = [
    query.txType ? formatBlockTxnType(query.txType) : undefined,
    query.assetId === undefined ? undefined : `asset ${query.assetId}`,
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

/** The row's kind as the graph names it: creates say so, not "Application Call" / "Asset Config". */
export function rowType(row: TransactionRowData): string {
  const kind = transactionKind(row)
  if (kind === 'appCreate') return 'Application Create'
  if (kind === 'assetCreate') return 'Asset Create'
  return formatBlockTxnType(row.type ?? 'txn')
}

export function rowAmount(row: TransactionRowData): string | undefined {
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

/** Rows with their inner transactions flattened beneath them, depth-first. */
function withInners(
  rows: ReadonlyArray<TransactionRowData>,
  depth = 0,
): Array<{ row: TransactionRowData; depth: number }> {
  return rows.flatMap((row) => [{ row, depth }, ...withInners(row.innerTxns ?? [], depth + 1)])
}

/** A sort key that keeps inner rows glued beneath their parent: sort on the parent, then by depth. */
type FlatRow = { row: TransactionRowData; depth: number; parent: TransactionRowData }

function flatRows(rows: ReadonlyArray<TransactionRowData>): FlatRow[] {
  return rows.flatMap((parent) => withInners([parent]).map((entry) => ({ ...entry, parent })))
}

export function TransactionListCard({
  title,
  groupId,
  transactions,
  nextToken,
  query,
  onOpen,
  onMore,
  loadingMore,
  action,
}: {
  title: string
  groupId?: string
  transactions: ReadonlyArray<TransactionRowData>
  nextToken?: string
  query?: Parameters<typeof queryLabel>[0]
  onOpen?: (txid: string) => void
  onMore?: () => void
  loadingMore?: boolean
  action?: React.ReactNode
}) {
  const filter = query ? queryLabel(query) : undefined
  const innerType = query?.txType
  const viaInner = innerType ? transactions.filter((row) => row.type !== undefined && row.type !== innerType).length : 0
  const rows = flatRows(transactions)
  const amountValue = (row: TransactionRowData): bigint | undefined =>
    row.paymentAmountMicroAlgos !== undefined
      ? BigInt(row.paymentAmountMicroAlgos)
      : row.assetAmount !== undefined
        ? BigInt(row.assetAmount)
        : undefined
  const columns: Column<FlatRow>[] = [
    {
      key: 'type',
      label: 'type',
      width: 'minmax(7rem, .9fr)',
      sortValue: ({ parent }) => rowType(parent),
      cell: ({ row, depth }) => (
        <span className={depth > 0 ? 'muted' : undefined}>
          {depth > 0 ? `${'  '.repeat(depth - 1)}└ ` : ''}
          <span className={`kind kind-${row.type ?? 'txn'}`}>{rowType(row)}</span>
          {innerType && row.type !== undefined && row.type !== innerType ? '*' : ''}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'amount',
      align: 'right',
      width: 'minmax(6rem, .8fr)',
      sortValue: ({ parent }) => amountValue(parent),
      cell: ({ row }) => rowAmount(row) ?? '',
    },
    {
      key: 'party',
      label: 'from → to',
      width: 'minmax(10rem, 1.6fr)',
      cell: ({ row }) => {
        const to = rowCounterparty(row)
        return (
          <>
            <Copyable value={row.sender} display={shorten(row.sender, 10)} />
            {to ? (
              <>
                {' → '}
                {row.receiver ? <Copyable value={row.receiver} display={shorten(row.receiver, 10)} /> : to}
              </>
            ) : null}
          </>
        )
      },
    },
    {
      key: 'round',
      label: 'round',
      align: 'right',
      width: 'minmax(5rem, .6fr)',
      sortValue: ({ parent }) => parent.confirmedRound,
      cell: ({ row }) => (row.confirmedRound === undefined ? '' : String(row.confirmedRound)),
    },
    {
      key: 'time',
      label: 'time',
      width: 'minmax(6rem, .7fr)',
      sortValue: ({ parent }) => parent.roundTime,
      cell: ({ row }) => (row.roundTime === undefined ? '' : formatExplorerTime(row.roundTime)),
    },
  ]
  return (
    <Frame>
      <Header kicker={title} chip={filter} pill={String(transactions.length)} tone="idle" action={action} />
      {groupId ? (
        <Facts>
          <Fact label="group" value={groupId} copy={groupId} />
        </Facts>
      ) : null}
      <Table
        columns={columns}
        rows={rows}
        keyOf={({ row }, index) => `${row.id ?? row.sender}-${index}`}
        searchText={({ row }) =>
          [row.id, rowType(row), row.sender, row.receiver, row.applicationId, row.assetId, row.assetUnitName, row.note]
            .filter(Boolean)
            .join(' ')
        }
        onOpen={onOpen ? ({ row }) => row.id && onOpen(row.id) : undefined}
      />
      {viaInner > 0 && innerType ? (
        <FooterNote text={`* ${viaInner} app call${viaInner === 1 ? '' : 's'} matched through inner ${formatBlockTxnType(innerType)} txns`} />
      ) : null}
      <MoreFooter count={transactions.length} nextToken={nextToken} onMore={onMore} loadingMore={loadingMore} />
    </Frame>
  )
}
