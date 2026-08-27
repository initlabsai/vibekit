/**
 * Alpha Arcade formatting: raw numbers, no "$" strings, Usd-suffixed field
 * names, slippage converted.
 */
import type { Market, OpenOrder, Orderbook, WalletPosition } from '@alpha-arcade/sdk'

const MICROUNIT = 1_000_000

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
    yesPriceUsd: m.yesProb ?? undefined,
    yesProb: m.yesProb ?? undefined,
    noPriceUsd: m.noProb ?? undefined,
    noProb: m.noProb ?? undefined,
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
      yesPriceUsd: o.yesProb ?? undefined,
      yesProb: o.yesProb ?? undefined,
      noPriceUsd: o.noProb ?? undefined,
      noProb: o.noProb ?? undefined,
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
