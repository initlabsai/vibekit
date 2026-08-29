/** Alpha Arcade cards: markets, one market, the book, positions, orders. */
import type {
  MarketRow,
  Markets,
  OpenOrders,
  OrderbookView,
  Positions,
} from '@initlabs/vibekit/plugins/alpha-arcade'

import { ListCard } from '../../generic-cards.js'
import { Fact, Frame, Header, Hero, innerWidth } from '../../primitives.js'
import { COLORS } from '../../theme.js'
import { compactUsd } from './market.js'

export function percent(price: number | undefined): string {
  return price === undefined ? '—' : `${Math.round(price * 100)}%`
}

export function endsIn(endTs: number, now = Date.now() / 1000): string {
  const seconds = endTs - now
  if (seconds <= 0) return 'closed'
  if (seconds < 3600) return `in ${Math.max(1, Math.round(seconds / 60))}m`
  if (seconds < 86400) return `in ${Math.round(seconds / 3600)}h`
  return `in ${Math.round(seconds / 86400)}d`
}

export function MarketsCard({
  data,
  network,
  width,
  onOpen,
}: {
  data: Markets
  network: string
  width: number
  onOpen?: (marketAppId: number) => void
}) {
  return (
    <ListCard
      kicker="MARKETS"
      chip="ALPHA ARCADE"
      pill={network.toUpperCase()}
      rows={data.markets}
      keyOf={(m) => m.id}
      lead={(m) => ({ label: 'app', value: String(m.marketAppId), copy: String(m.marketAppId) })}
      onOpen={onOpen && ((m) => onOpen(m.marketAppId))}
      facts={(m, body) => (
        <>
          <Fact label="market" value={m.title} width={body} />
          <Fact
            label="yes"
            value={`${percent(m.yesPriceUsd)} · vol ${compactUsd(m.volumeUsd ?? null)} · ends ${endsIn(m.endTs)}`}
            width={body}
          />
        </>
      )}
      width={width}
    />
  )
}

export function MarketCard({
  data,
  network,
  width,
}: {
  data: MarketRow
  network: string
  width: number
}) {
  const body = innerWidth(width)
  const bar = Math.max(8, Math.min(30, body - 12))
  const yes = Math.round((data.yesPriceUsd ?? 0) * bar)
  return (
    <Frame width={width}>
      <Header
        kicker="MARKET"
        chip="ALPHA ARCADE"
        pill={data.isResolved ? 'RESOLVED' : 'LIVE'}
        tone={data.isResolved ? undefined : 'ok'}
      />
      <Hero value={data.title} />
      <box marginTop={1} flexDirection="row">
        <text fg={COLORS.signal}>{`YES ${percent(data.yesPriceUsd).padStart(4)} `}</text>
        <text fg={COLORS.signal}>{'█'.repeat(yes)}</text>
        <text fg={COLORS.brass}>{'█'.repeat(bar - yes)}</text>
        <text fg={COLORS.brass}>{` ${percent(data.noPriceUsd).padStart(4)} NO`}</text>
      </box>
      <box marginTop={1} flexDirection="column">
        <Fact
          label="app"
          value={String(data.marketAppId)}
          copy={String(data.marketAppId)}
          width={body}
        />
        <Fact label="volume" value={compactUsd(data.volumeUsd ?? null)} width={body} />
        <Fact label="ends" value={endsIn(data.endTs)} width={body} />
        {data.categories?.length ? (
          <Fact label="category" value={data.categories.join(', ')} width={body} />
        ) : null}
        <Fact label="network" value={network} width={body} />
      </box>
    </Frame>
  )
}

export function OrderbookCard({ data, width }: { data: OrderbookView; width: number }) {
  const body = innerWidth(width)
  const line = (label: string, side: OrderbookView['yes']) => {
    const best = (levels: OrderbookView['yes']['bids'], pick: 'max' | 'min') =>
      levels.length === 0
        ? '—'
        : percent(
            levels.reduce(
              (a, b) => (pick === 'max' ? Math.max(a, b.priceUsd) : Math.min(a, b.priceUsd)),
              pick === 'max' ? 0 : 1,
            ),
          )
    return (
      <Fact
        label={label}
        value={`bid ${best(side.bids, 'max')} · ask ${best(side.asks, 'min')} · ${side.bids.length + side.asks.length} orders`}
        width={body}
      />
    )
  }
  return (
    <Frame width={width}>
      <Header kicker="ORDERBOOK" chip="ALPHA ARCADE" pill={`APP ${data.marketAppId}`} />
      <box marginTop={1} flexDirection="column">
        {line('yes', data.yes)}
        {line('no', data.no)}
      </box>
    </Frame>
  )
}

export function PositionsCard({
  data,
  width,
  onOpen,
}: {
  data: Positions
  width: number
  onOpen?: (marketAppId: number) => void
}) {
  return (
    <ListCard
      kicker="POSITIONS"
      chip="ALPHA ARCADE"
      pill={String(data.positions.length)}
      rows={data.positions}
      keyOf={(p) => String(p.marketAppId)}
      lead={(p) => ({ label: 'app', value: String(p.marketAppId), copy: String(p.marketAppId) })}
      onOpen={onOpen && ((p) => onOpen(p.marketAppId))}
      facts={(p, body) => (
        <>
          <Fact label="market" value={p.title} width={body} />
          <Fact
            label="shares"
            value={`YES ${p.yesBalance.toLocaleString()} · NO ${p.noBalance.toLocaleString()}`}
            width={body}
          />
        </>
      )}
      width={width}
    />
  )
}

export function OrdersCard({ data, width }: { data: OpenOrders; width: number }) {
  return (
    <ListCard
      kicker="OPEN ORDERS"
      chip="ALPHA ARCADE"
      pill={`APP ${data.marketAppId}`}
      rows={data.orders}
      keyOf={(o) => String(o.escrowAppId)}
      lead={(o) => ({ label: 'escrow', value: String(o.escrowAppId), copy: String(o.escrowAppId) })}
      facts={(o, body) => (
        <Fact
          label="order"
          value={`${o.side} ${o.position} @ ${percent(o.priceUsd)} · ${o.quantityFilled ? `${o.quantityFilled.toLocaleString()} / ` : ''}${o.quantity.toLocaleString()} shares`}
          width={body}
        />
      )}
      width={width}
    />
  )
}
