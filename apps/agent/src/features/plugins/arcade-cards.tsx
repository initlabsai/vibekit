'use client'

/** Alpha Arcade: markets as a list, one market with its YES/NO prices, the book as depth, an account's positions and orders. */
import type {
  MarketRow,
  Markets,
  OpenOrders,
  OrderbookView,
  Positions,
} from '@initlabs/vibekit/views'

import { MoreFooter, Table, type Column } from '../../generic-cards'
import { Button, Copyable, Fact, Facts, FooterNote, Frame, Header } from '../../primitives'
import { shorten } from '../../theme'
import { compactUsd } from './market-cards'

/** `65%` from a $0.65 share; an em dash when the market has no price yet. */
export function percent(price: number | undefined): string {
  return price === undefined ? '—' : `${Math.round(price * 100)}%`
}

/** `in 3d`, `in 4h`, `closed` — relative to now, coarse on purpose. */
export function endsIn(endTs: number, now = Date.now() / 1000): string {
  const seconds = endTs - now
  if (seconds <= 0) return 'closed'
  if (seconds < 3600) return `in ${Math.max(1, Math.round(seconds / 60))}m`
  if (seconds < 86400) return `in ${Math.round(seconds / 3600)}h`
  return `in ${Math.round(seconds / 86400)}d`
}

function status(m: MarketRow): { label: string; tone: 'ok' | 'idle' | 'warn' } {
  if (m.isResolved)
    return {
      label: m.resolution === 1 ? 'RESOLVED YES' : m.resolution === 0 ? 'RESOLVED NO' : 'RESOLVED',
      tone: 'idle',
    }
  if (m.isLive === false) return { label: 'PAUSED', tone: 'warn' }
  return { label: 'LIVE', tone: 'ok' }
}

function Thumb({ src }: { src: string | undefined }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src?.startsWith('https://') ? <img className="arcade-thumb" src={src} alt="" width={28} height={28} /> : null
}

/** YES and NO as one bar: teal for YES's share, brass for NO's; the numbers sit at the ends. */
function Odds({ yes, no }: { yes: number | undefined; no: number | undefined }) {
  const share = yes !== undefined ? Math.round(yes * 100) : no !== undefined ? 100 - Math.round(no * 100) : undefined
  return (
    <div className="odds" role="img" aria-label={`YES ${percent(yes)}, NO ${percent(no)}`}>
      <span className="odds-end odds-yes">
        <b>{percent(yes)}</b> yes
      </span>
      <span className="odds-track">
        {share === undefined ? <span className="odds-empty" /> : <span className="odds-fill" style={{ width: `${share}%` }} />}
      </span>
      <span className="odds-end odds-no">
        no <b>{percent(no)}</b>
      </span>
    </div>
  )
}

export function MarketsCard({
  data,
  network,
  onOpen,
  onMore,
  loadingMore,
}: {
  data: Markets
  network: string
  onOpen?: (marketId: string) => void
  onMore?: () => void
  loadingMore?: boolean
}) {
  const columns: Column<MarketRow>[] = [
    {
      key: 'title',
      label: 'market',
      width: 'minmax(12rem, 3fr)',
      cell: (m) => (
        <span className="arcade-title">
          <Thumb src={m.image} />
          {m.title}
        </span>
      ),
    },
    {
      key: 'yes',
      label: 'yes',
      align: 'right',
      width: 'minmax(5rem, 1fr)',
      sortValue: (m) => m.yesPriceUsd ?? -1,
      cell: (m) => (
        <span className="prob">
          <span
            className="prob-bar"
            style={{ width: `${Math.round((m.yesPriceUsd ?? 0) * 100)}%` }}
          />
          <span className="prob-value">{percent(m.yesPriceUsd)}</span>
        </span>
      ),
    },
    {
      key: 'volume',
      label: 'volume',
      align: 'right',
      sortValue: (m) => m.volumeUsd ?? 0,
      cell: (m) => compactUsd(m.volumeUsd ?? null),
    },
    {
      key: 'ends',
      label: 'ends',
      align: 'right',
      width: 'minmax(4rem, .6fr)',
      sortValue: (m) => m.endTs,
      cell: (m) => endsIn(m.endTs),
    },
  ]
  return (
    <Frame>
      <Header
        kicker="MARKETS"
        chip="ALPHA ARCADE"
        pill={`${data.markets.length}${data.total > data.markets.length ? ` of ${data.total}` : ''}`}
        tone="idle"
      />
      {data.markets.length === 0 ? (
        <FooterNote text="No live markets." />
      ) : (
        <Table
          columns={columns}
          rows={data.markets}
          keyOf={(m) => m.id}
          searchText={(m) => `${m.title} ${m.categories?.join(' ') ?? ''}`}
          onOpen={onOpen ? (m) => onOpen(String(m.marketAppId)) : undefined}
        />
      )}
      <MoreFooter
        count={data.markets.length}
        nextToken={data.nextToken}
        onMore={onMore}
        loadingMore={loadingMore}
      />
      <FooterNote text={`${network} · YES price is the implied probability`} />
    </Frame>
  )
}

export function MarketCard({
  data,
  network,
  onBuy,
  onOrderbook,
}: {
  data: MarketRow
  network: string
  onBuy?: (side: 'yes' | 'no') => void
  onOrderbook?: () => void
}) {
  const state = status(data)
  const closed = data.isResolved || endsIn(data.endTs) === 'closed'
  const ends = new Date(data.endTs * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  return (
    <Frame>
      <Header kicker="MARKET" chip="ALPHA ARCADE" pill={state.label} tone={state.tone} action={onOrderbook ? <Button label="orderbook ▸" onPress={onOrderbook} /> : undefined} />
      <p className="hero arcade-hero">
        <Thumb src={data.image} />
        <span className="hero-value">{data.title}</span>
      </p>
      <Odds yes={data.yesPriceUsd} no={data.noPriceUsd} />
      {onBuy && !closed ? (
        <p className="arcade-actions">
          <Button label="buy yes" onPress={() => onBuy('yes')} />
          <Button label="buy no" onPress={() => onBuy('no')} />
        </p>
      ) : null}
      <Facts>
        <Fact label="volume" value={compactUsd(data.volumeUsd ?? null)} />
        <Fact label="ends" value={`${endsIn(data.endTs)} · ${ends}`} />
        {data.categories?.length ? <Fact label="category" value={data.categories.join(', ')} /> : null}
        <Fact label="app" value={String(data.marketAppId)} copy={String(data.marketAppId)} />
        {data.yesAssetId ? <Fact label="shares" value={`YES ${data.yesAssetId} · NO ${data.noAssetId}`} /> : null}
      </Facts>
      {data.options?.length ? (
        <ol className="arcade-options">
          {data.options.map((o) => (
            <li key={o.id} className="arcade-option">
              <span>{o.title}</span>
              <span className="prob-value">{percent(o.yesPriceUsd)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <FooterNote text={`${network} · a share pays $1 if right, so the price is the crowd's probability`} />
    </Frame>
  )
}

type Level = OrderbookView['yes']['bids'][number]

function Book({ label, side, max }: { label: string; side: OrderbookView['yes']; max: number }) {
  const rows = [
    ...side.asks
      .slice()
      .sort((a, b) => b.priceUsd - a.priceUsd)
      .map((l) => ({ ...l, kind: 'ask' as const })),
    ...side.bids
      .slice()
      .sort((a, b) => b.priceUsd - a.priceUsd)
      .map((l) => ({ ...l, kind: 'bid' as const })),
  ]
  return (
    <div className="book">
      <p className="book-label">{label}</p>
      {rows.length === 0 ? <p className="muted">empty</p> : null}
      {rows.map((l: Level & { kind: 'ask' | 'bid' }, i) => (
        <div key={`${l.escrowAppId}-${i}`} className={`book-row book-${l.kind}`}>
          <span
            className="book-depth"
            style={{ width: `${Math.max(2, (l.quantity / max) * 100)}%` }}
          />
          <span className="book-price">{percent(l.priceUsd)}</span>
          <span className="book-qty">
            {l.quantity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
    </div>
  )
}

export function OrderbookCard({ data, onMarket }: { data: OrderbookView; onMarket?: () => void }) {
  const max = Math.max(
    1,
    ...[...data.yes.bids, ...data.yes.asks, ...data.no.bids, ...data.no.asks].map(
      (l) => l.quantity,
    ),
  )
  return (
    <Frame>
      <Header
        kicker="ORDERBOOK"
        chip="ALPHA ARCADE"
        pill={`APP ${data.marketAppId}`}
        tone="idle"
        action={onMarket ? <Button label="market ▸" onPress={onMarket} /> : undefined}
      />
      <div className="books">
        <Book label="YES" side={data.yes} max={max} />
        <Book label="NO" side={data.no} max={max} />
      </div>
      <FooterNote text="asks above, bids below · bar = shares" />
    </Frame>
  )
}

export function PositionsCard({
  data,
  onOpen,
}: {
  data: Positions
  onOpen?: (marketId: string) => void
}) {
  type Row = Positions['positions'][number]
  const columns: Column<Row>[] = [
    { key: 'title', label: 'market', width: 'minmax(12rem, 3fr)', cell: (p) => p.title },
    {
      key: 'yes',
      label: 'yes shares',
      align: 'right',
      sortValue: (p) => p.yesBalance,
      cell: (p) => (p.yesBalance ? p.yesBalance.toLocaleString() : '—'),
    },
    {
      key: 'no',
      label: 'no shares',
      align: 'right',
      sortValue: (p) => p.noBalance,
      cell: (p) => (p.noBalance ? p.noBalance.toLocaleString() : '—'),
    },
  ]
  return (
    <Frame>
      <Header
        kicker="POSITIONS"
        chip="ALPHA ARCADE"
        pill={String(data.positions.length)}
        tone="idle"
      />
      <Facts>
        <Fact label="account">
          <Copyable value={data.walletAddress} display={shorten(data.walletAddress, 20)} />
        </Fact>
      </Facts>
      {data.positions.length === 0 ? (
        <FooterNote text="No positions." />
      ) : (
        <Table
          columns={columns}
          rows={data.positions}
          keyOf={(p) => String(p.marketAppId)}
          searchText={(p) => p.title}
          onOpen={onOpen ? (p) => onOpen(String(p.marketAppId)) : undefined}
        />
      )}
    </Frame>
  )
}

export function OrdersCard({
  data,
  onCancel,
}: {
  data: OpenOrders
  onCancel?: (escrowAppId: number) => void
}) {
  type Row = OpenOrders['orders'][number]
  const columns: Column<Row>[] = [
    { key: 'side', label: 'order', cell: (o) => `${o.side} ${o.position}` },
    {
      key: 'price',
      label: 'price',
      align: 'right',
      sortValue: (o) => o.priceUsd,
      cell: (o) => percent(o.priceUsd),
    },
    {
      key: 'qty',
      label: 'shares',
      align: 'right',
      sortValue: (o) => o.quantity,
      cell: (o) =>
        `${o.quantityFilled ? `${o.quantityFilled.toLocaleString()} / ` : ''}${o.quantity.toLocaleString()}`,
    },
    { key: 'escrow', label: 'escrow', align: 'right', cell: (o) => String(o.escrowAppId) },
    ...(onCancel
      ? [
          {
            key: 'cancel',
            label: '',
            align: 'right' as const,
            cell: (o: Row) => <Button label="cancel" onPress={() => onCancel(o.escrowAppId)} />,
          },
        ]
      : []),
  ]
  return (
    <Frame>
      <Header
        kicker="OPEN ORDERS"
        chip="ALPHA ARCADE"
        pill={`APP ${data.marketAppId}`}
        tone="idle"
      />
      {data.orders.length === 0 ? (
        <FooterNote text="No open orders." />
      ) : (
        <Table
          columns={columns}
          rows={data.orders}
          keyOf={(o) => String(o.escrowAppId)}
          searchText={(o) => `${o.side} ${o.position}`}
        />
      )}
    </Frame>
  )
}
