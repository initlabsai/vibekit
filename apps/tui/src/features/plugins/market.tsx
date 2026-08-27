import type { AssetPrices, RankedAssets } from '@initlabs/vibekit/plugins/vestige'

import { Button, Fact, Frame, Header, innerWidth, Rule } from '../../primitives.js'
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
