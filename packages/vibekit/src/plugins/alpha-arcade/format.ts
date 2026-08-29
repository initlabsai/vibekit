/**
 * Alpha Arcade formatting: raw numbers, no "$" strings, Usd-suffixed field
 * names, slippage converted.
 */
import type { Market, OpenOrder, Orderbook, WalletPosition } from '@alpha-arcade/sdk'

const MICROUNIT = 1_000_000

/** A probability from either scale: the API sends microunits (242500), the chain 0..1. */
export function prob(value: number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  return value > 1 ? value / MICROUNIT : value
}

/** A timestamp in seconds; the cached feed sends milliseconds. */
function seconds(ts: number | undefined): number {
  return ts === undefined ? 0 : ts > 1e10 ? Math.floor(ts / 1000) : ts
}

/** One market group from `get-live-markets-cached`: a single option is the market; several are its options. */
export interface CachedFeedMarket {
  id: string
  title?: string
  slug?: string
  image?: string
  endTs?: number
  volume?: number
  categories?: string[]
  hidden?: boolean
  featured?: boolean
  options?: Array<{
    id: string
    label?: string
    title?: string
    /** Absent until the option's market app is live on chain. */
    marketAppId?: number
    yesAssetId?: number
    noAssetId?: number
    yesProb?: number
    noProb?: number
    volume?: number
  }>
}

/** Shapes a cached-feed group into the SDK's Market, so one formatter serves both sources. */
export function marketFromCachedFeed(raw: CachedFeedMarket): Market | undefined {
  // An option without its app is not tradable yet; a market with none of them is not a market yet.
  const options = (raw.options ?? []).filter(
    (o): o is typeof o & { marketAppId: number; yesAssetId: number; noAssetId: number } =>
      typeof o.marketAppId === 'number' &&
      typeof o.yesAssetId === 'number' &&
      typeof o.noAssetId === 'number',
  )
  const first = options[0]
  if (!first) return undefined
  const single = options.length === 1
  return {
    id: raw.id,
    title: String(raw.title ?? ''),
    slug: raw.slug,
    image: raw.image,
    marketAppId: first.marketAppId,
    yesAssetId: single ? first.yesAssetId : 0,
    noAssetId: single ? first.noAssetId : 0,
    ...(single ? { yesProb: prob(first.yesProb), noProb: prob(first.noProb) } : {}),
    volume: raw.volume ?? (single ? first.volume : undefined),
    endTs: seconds(raw.endTs),
    isLive: true,
    isResolved: false,
    categories: raw.categories,
    featured: raw.featured,
    source: 'api',
    ...(single
      ? {}
      : {
          options: options.map((o) => ({
            id: o.id,
            title: String(o.title ?? o.label ?? ''),
            marketAppId: o.marketAppId,
            yesProb: prob(o.yesProb) ?? 0,
            noProb: prob(o.noProb) ?? 0,
          })),
        }),
  } as Market
}

/** Convert microunits to USD as a raw number — consumers handle formatting. */
export function microToUsd(micro: number): number {
  return micro / MICROUNIT
}

/** Convert microunits to a share quantity — same scale as USD. */
export const microToShares = microToUsd

export function formatMarket(m: Market) {
  return {
    id: m.id,
    title: m.title,
    slug: m.slug,
    image: m.image,
    marketAppId: m.marketAppId,
    yesAssetId: m.yesAssetId,
    noAssetId: m.noAssetId,
    // A share pays $1, so price-in-USD equals probability; both exposed raw.
    yesPriceUsd: prob(m.yesProb),
    yesProb: prob(m.yesProb),
    noPriceUsd: prob(m.noProb),
    noProb: prob(m.noProb),
    volumeUsd: m.volume,
    endTs: m.endTs,
    resolution: m.resolution,
    isResolved: m.isResolved,
    isLive: m.isLive,
    categories: m.categories,
    featured: m.featured,
    feeBase: m.feeBase,
    totalRewardsUsd: m.totalRewards,
    rewardsPaidOutUsd: m.rewardsPaidOut,
    rewardsSpreadDistance: m.rewardsSpreadDistance,
    rewardsMinContracts: m.rewardsMinContracts,
    lastRewardAmountUsd: m.lastRewardAmount,
    lastRewardTs: m.lastRewardTs,
    options: m.options?.map((o) => ({
      id: o.id,
      title: o.title,
      marketAppId: o.marketAppId,
      yesPriceUsd: prob(o.yesProb),
      yesProb: prob(o.yesProb),
      noPriceUsd: prob(o.noProb),
      noProb: prob(o.noProb),
    })),
    source: m.source,
  }
}

export function formatOrderbook(ob: Orderbook) {
  const formatEntry = (e: {
    price: number
    quantity: number
    escrowAppId: number
    owner: string
  }) => ({
    priceUsd: microToUsd(e.price),
    quantity: microToShares(e.quantity),
    escrowAppId: e.escrowAppId,
    owner: e.owner,
  })
  return {
    yes: { bids: ob.yes.bids.map(formatEntry), asks: ob.yes.asks.map(formatEntry) },
    no: { bids: ob.no.bids.map(formatEntry), asks: ob.no.asks.map(formatEntry) },
  }
}

export function formatPosition(p: WalletPosition) {
  return {
    marketAppId: p.marketAppId,
    title: p.title,
    yesAssetId: p.yesAssetId,
    noAssetId: p.noAssetId,
    yesBalance: microToShares(p.yesBalance),
    noBalance: microToShares(p.noBalance),
  }
}

export function formatOpenOrder(o: OpenOrder) {
  return {
    escrowAppId: o.escrowAppId,
    marketAppId: o.marketAppId,
    position: o.position === 1 ? 'YES' : 'NO',
    side: o.side === 1 ? 'BUY' : 'SELL',
    priceUsd: microToUsd(o.price),
    quantity: microToShares(o.quantity),
    quantityFilled: microToShares(o.quantityFilled),
    // Slippage arrives in raw microunits; convert like the other prices.
    slippageUsd: microToUsd(o.slippage),
    owner: o.owner,
  }
}

export type FormattedMarket = ReturnType<typeof formatMarket>
export type FormattedOrderbook = ReturnType<typeof formatOrderbook>
export type FormattedPosition = ReturnType<typeof formatPosition>
export type FormattedOpenOrder = ReturnType<typeof formatOpenOrder>
