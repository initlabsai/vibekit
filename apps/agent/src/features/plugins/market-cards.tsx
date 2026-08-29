'use client'

/** Vestige market data: USD prices for named assets, and the activity-ranked search. */
import type { AssetPrices, RankedAssets } from '@initlabs/vibekit-explorer'

import { Table, type Column } from '../../generic-cards'
import { AssetMark, FooterNote, Frame, Header } from '../../primitives'

/** Trims a plain-decimal price to 6 significant digits; the wire stays exact. Truncates, never rounds up. */
export function trimPrice(text: string): string {
  const clean = text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
  const match = /^(\d+)\.(0*)([1-9]\d*)$/.exec(clean)
  if (!match) return clean
  const [, whole, zeros, digits] = match
  return digits!.length <= 6 ? clean : `${whole}.${zeros}${digits!.slice(0, 6)}`
}

/** Compact dollar figure; null is an em dash. */
export function compactUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

type PriceRow = AssetPrices['prices'][number]

export function MarketPricesCard({
  data,
  network,
  onOpen,
}: {
  data: AssetPrices
  network: string
  onOpen?: (assetId: number) => void
}) {
  const columns: Column<PriceRow>[] = [
    {
      key: 'asset',
      label: 'asset',
      cell: (r) => (r.assetId === 0 ? 'ALGO' : <AssetMark assetId={r.assetId} />),
    },
    {
      key: 'price',
      label: 'price',
      align: 'right',
      sortValue: (r) => Number(r.priceUsd),
      cell: (r) => `$${trimPrice(r.priceUsd)}`,
    },
    {
      key: 'confidence',
      label: 'confidence',
      align: 'right',
      width: 'minmax(6rem, .6fr)',
      sortValue: (r) => r.confidence,
      cell: (r) =>
        r.confidence < 0.5 ? `${r.confidence.toFixed(2)} low` : r.confidence.toFixed(2),
    },
  ]
  return (
    <Frame>
      <Header kicker="PRICES" chip="VESTIGE" pill={network.toUpperCase()} tone="idle" />
      {data.prices.length === 0 ? (
        <FooterNote text="No prices." />
      ) : (
        <Table
          columns={columns}
          rows={data.prices}
          keyOf={(r) => String(r.assetId)}
          searchText={(r) => String(r.assetId)}
          onOpen={onOpen ? (r) => (r.assetId === 0 ? undefined : onOpen(r.assetId)) : undefined}
        />
      )}
    </Frame>
  )
}

type RankedRow = RankedAssets['assets'][number]

export function MarketRankedCard({
  data,
  network,
  onOpen,
}: {
  data: RankedAssets
  network: string
  onOpen?: (assetId: number) => void
}) {
  const columns: Column<RankedRow>[] = [
    {
      key: 'rank',
      label: '#',
      width: 'minmax(3rem, .3fr)',
      sortValue: (r) => r.rank ?? Number.MAX_SAFE_INTEGER,
      cell: (r) => (r.rank === null ? '—' : String(r.rank)),
    },
    {
      key: 'name',
      label: 'asset',
      cell: (r) => (
        <AssetMark
          assetId={r.assetId}
          name={r.name ?? undefined}
          unitName={r.ticker ?? undefined}
        />
      ),
    },
    {
      key: 'price',
      label: 'price',
      align: 'right',
      sortValue: (r) => Number(r.priceUsd ?? 0),
      cell: (r) => (r.priceUsd === null ? '—' : `$${trimPrice(r.priceUsd)}`),
    },
    {
      key: 'cap',
      label: 'mkt cap',
      align: 'right',
      sortValue: (r) => r.marketCapUsd ?? 0,
      cell: (r) => compactUsd(r.marketCapUsd),
    },
    {
      key: 'tvl',
      label: 'tvl',
      align: 'right',
      sortValue: (r) => r.tvlUsd ?? 0,
      cell: (r) => compactUsd(r.tvlUsd),
    },
    {
      key: 'vol',
      label: 'vol 24h',
      align: 'right',
      sortValue: (r) => r.volume1dUsd ?? 0,
      cell: (r) => compactUsd(r.volume1dUsd),
    },
  ]
  return (
    <Frame>
      <Header kicker="MARKETS" chip="VESTIGE" pill={network.toUpperCase()} tone="idle" />
      {data.assets.length === 0 ? (
        <FooterNote text="No assets." />
      ) : (
        <Table
          columns={columns}
          rows={data.assets}
          keyOf={(r) => String(r.assetId)}
          searchText={(r) => `${r.assetId} ${r.name ?? ''} ${r.ticker ?? ''}`}
          onOpen={onOpen ? (r) => onOpen(r.assetId) : undefined}
        />
      )}
    </Frame>
  )
}
