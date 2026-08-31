import type {
  AssetHistory,
  AssetPrices,
  DefiProtocols,
  RankedAssets,
} from '@initlabs/vibekit/plugins/vestige'

import { Button, Fact, Frame, Header, Hero, innerWidth, Rule } from '../../primitives.js'
import { COLORS } from '../../theme.js'
import { ListCard } from '../../generic-cards.js'

/**
 * Trims a plain-decimal price to 6 significant digits for display — the wire
 * string stays exact; a 22-digit memecoin price is noise on a card. Truncates
 * rather than rounds, so the card never overstates.
 */
export function trimPrice(text: string): string {
  const clean = text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
  const match = /^(\d+)\.(0*)([1-9]\d*)$/.exec(clean)
  if (!match) return clean
  const [, whole, zeros, digits] = match
  return digits!.length <= 6 ? clean : `${whole}.${zeros}${digits!.slice(0, 6)}`
}

/** Compact dollar figure for market-size fields; null renders as an em dash. */
export function compactUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

/** USD prices from Vestige (the `vestige.prices` view). */
export function MarketPricesCard({
  data,
  network,
  width,
  onOpen,
}: {
  data: AssetPrices
  network: string
  width: number
  onOpen?: (assetId: number) => void
}) {
  return (
    <ListCard
      kicker="PRICES"
      chip="VESTIGE"
      pill={network.toUpperCase()}
      rows={data.prices}
      keyOf={(row) => String(row.assetId)}
      lead={(row) => ({
        label: 'asset',
        value: row.assetId === 0 ? 'ALGO' : String(row.assetId),
        copy: String(row.assetId),
      })}
      canOpen={(row) => row.assetId !== 0}
      onOpen={onOpen && ((row) => onOpen(row.assetId))}
      facts={(row, body) => (
        <>
          <Fact label="price" value={`$${trimPrice(row.priceUsd)}`} width={body} />
          {row.confidence < 0.5 ? (
            <Fact label="confidence" value={`low (${row.confidence.toFixed(2)})`} width={body} />
          ) : null}
        </>
      )}
      width={width}
    />
  )
}

/** Activity-ranked asset search from Vestige (the `vestige.markets` view). */
export function MarketRankedCard({
  data,
  network,
  width,
  onOpen,
}: {
  data: RankedAssets
  network: string
  width: number
  onOpen?: (assetId: number) => void
}) {
  return (
    <ListCard
      kicker="MARKETS"
      chip="VESTIGE"
      pill={network.toUpperCase()}
      rows={data.assets}
      keyOf={(asset) => String(asset.assetId)}
      lead={(asset) => ({ label: 'id', value: String(asset.assetId), copy: String(asset.assetId) })}
      onOpen={onOpen && ((asset) => onOpen(asset.assetId))}
      facts={(asset, body) => (
        <>
          <Fact
            label="name"
            value={[asset.ticker, asset.name].filter(Boolean).join(' — ') || '—'}
            width={body}
          />
          {asset.rank !== null ? <Fact label="rank" value={`#${asset.rank}`} width={body} /> : null}
          <Fact
            label="price"
            value={asset.priceUsd !== null ? `$${trimPrice(asset.priceUsd)}` : '—'}
            width={body}
          />
          <Fact
            label="market"
            value={`cap ${compactUsd(asset.marketCapUsd)} · tvl ${compactUsd(asset.tvlUsd)} · vol 24h ${compactUsd(asset.volume1dUsd)}`}
            width={body}
          />
        </>
      )}
      width={width}
    />
  )
}

const SPARK = '▁▂▃▄▅▆▇█'

/** Closes as a one-line sparkline, sampled to the width. */
export function sparkline(values: ReadonlyArray<number>, width: number): string {
  if (values.length === 0 || width <= 0) return ''
  const step = values.length / width
  const sampled = Array.from(
    { length: Math.min(width, values.length) },
    (_, i) => values[Math.floor(i * step)]!,
  )
  const min = Math.min(...sampled)
  const range = Math.max(...sampled) - min || 1
  return sampled.map((v) => SPARK[Math.round(((v - min) / range) * (SPARK.length - 1))]).join('')
}

/** `$0.0864` — trims to significant digits; sub-cent prices keep their zeros. */
export function priceLabel(value: number): string {
  return `$${trimPrice(value.toFixed(value < 1 ? 10 : 4))}`
}

/** USD price candles from Vestige (the `vestige.history` view). */
export function PriceHistoryCard({
  data,
  network,
  width,
  onOpen,
}: {
  data: AssetHistory
  network: string
  width: number
  onOpen?: (assetId: number) => void
}) {
  const body = innerWidth(width)
  const first = data.candles[0]
  const last = data.candles[data.candles.length - 1]
  const change =
    first && last && first.open > 0 ? ((last.close - first.open) / first.open) * 100 : undefined
  const low = data.candles.length ? Math.min(...data.candles.map((c) => c.low)) : undefined
  const high = data.candles.length ? Math.max(...data.candles.map((c) => c.high)) : undefined
  return (
    <Frame width={width}>
      <Header
        kicker="PRICE"
        chip="VESTIGE"
        pill={network.toUpperCase()}
        action={
          onOpen && data.assetId !== 0 ? (
            <Button label="asset ▸" onPress={() => onOpen(data.assetId)} />
          ) : undefined
        }
      />
      <Hero
        value={data.assetId === 0 ? 'ALGO' : `asset ${data.assetId}`}
        unit={
          last
            ? `${priceLabel(last.close)}${change === undefined ? '' : ` · ${change >= 0 ? '+' : ''}${change.toFixed(2)}% ${data.range}`}`
            : undefined
        }
      />
      <box marginTop={1}>
        <text fg={COLORS.signal}>
          {sparkline(
            data.candles.map((c) => c.close),
            body,
          )}
        </text>
      </box>
      <box marginTop={1} flexDirection="column">
        {low !== undefined ? <Fact label="low" value={priceLabel(low)} width={body} /> : null}
        {high !== undefined ? <Fact label="high" value={priceLabel(high)} width={body} /> : null}
        <Fact
          label="volume"
          value={compactUsd(data.candles.reduce((sum, c) => sum + c.volumeUsd, 0))}
          width={body}
        />
      </box>
    </Frame>
  )
}

/** Algorand DeFi TVL by protocol (the `vestige.protocols` view). */
export function DefiOverviewCard({
  data,
  network,
  width,
}: {
  data: DefiProtocols
  network: string
  width: number
}) {
  const body = innerWidth(width)
  const active = data.protocols.filter((p) => p.active && p.tvlUsd > 0)
  const max = active[0]?.tvlUsd ?? 1
  const bar = Math.max(6, Math.min(24, body - 34))
  return (
    <Frame width={width}>
      <Header kicker="DEFI" chip="VESTIGE" pill={network.toUpperCase()} />
      <Hero value={compactUsd(data.totalTvlUsd)} unit="locked in dex pools" />
      <box marginTop={1} flexDirection="column">
        {active.map((p) => {
          const filled = Math.max(1, Math.round((p.tvlUsd / max) * bar))
          return (
            <box key={p.id} flexDirection="row">
              <text fg={COLORS.text}>{`${p.name} ${p.version}`.padEnd(18).slice(0, 18)}</text>
              <text fg={COLORS.signal}>{'█'.repeat(filled)}</text>
              <text fg={COLORS.faint}>{'░'.repeat(bar - filled)}</text>
              <text fg={COLORS.muted}>{` ${compactUsd(p.tvlUsd)}`}</text>
            </box>
          )
        })}
      </box>
    </Frame>
  )
}
