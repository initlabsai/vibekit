import { z, type ZodSchema } from 'zod'
import type { AlphaClient, Market, Orderbook, WalletPosition, OpenOrder } from '@alpha-arcade/sdk'
import { microToDollars, microToShares, probToDollars } from './format'

/** Format a price that could be a probability (0-1) or microunits (>1) */
function formatPrice(value: number): string {
  if (value > 1) return microToDollars(value)
  return probToDollars(value)
}

export interface AlphaArcadeToolDefinition {
  name: string
  description: string
  parameters: ZodSchema
  handler: (client: AlphaClient, args: any) => Promise<unknown>
}

export function formatMarket(m: Market) {
  return {
    id: m.id,
    title: m.title,
    slug: m.slug,
    image: m.image,
    marketAppId: m.marketAppId,
    yesAssetId: m.yesAssetId,
    noAssetId: m.noAssetId,
    yesPrice: m.yesProb != null ? formatPrice(m.yesProb) : undefined,
    noPrice: m.noProb != null ? formatPrice(m.noProb) : undefined,
    volume: m.volume,
    endTs: m.endTs,
    resolution: m.resolution,
    isResolved: m.isResolved,
    isLive: m.isLive,
    categories: m.categories,
    featured: m.featured,
    feeBase: m.feeBase,
    totalRewards: m.totalRewards,
    rewardsPaidOut: m.rewardsPaidOut,
    rewardsSpreadDistance: m.rewardsSpreadDistance,
    rewardsMinContracts: m.rewardsMinContracts,
    lastRewardAmount: m.lastRewardAmount,
    lastRewardTs: m.lastRewardTs,
    options: m.options?.map((o) => ({
      id: o.id,
      title: o.title,
      marketAppId: o.marketAppId,
      yesPrice: o.yesProb != null ? formatPrice(o.yesProb) : undefined,
      noPrice: o.noProb != null ? formatPrice(o.noProb) : undefined,
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
    price: microToDollars(e.price),
    quantity: microToShares(e.quantity),
    escrowAppId: e.escrowAppId,
    owner: e.owner,
  })

  return {
    yes: {
      bids: ob.yes.bids.map(formatEntry),
      asks: ob.yes.asks.map(formatEntry),
    },
    no: {
      bids: ob.no.bids.map(formatEntry),
      asks: ob.no.asks.map(formatEntry),
    },
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
    price: microToDollars(o.price),
    quantity: microToShares(o.quantity),
    quantityFilled: microToShares(o.quantityFilled),
    slippage: o.slippage,
    owner: o.owner,
  }
}

// Derived output types — these are the shapes tools actually return
export type FormattedMarket = ReturnType<typeof formatMarket>
export type FormattedOrderbook = ReturnType<typeof formatOrderbook>
export type FormattedPosition = ReturnType<typeof formatPosition>
export type FormattedOpenOrder = ReturnType<typeof formatOpenOrder>

export const alphaArcadeTools: AlphaArcadeToolDefinition[] = [
  {
    name: 'get_live_markets',
    description:
      'Get all live prediction markets on Alpha Arcade. Returns market titles, current YES/NO prices, volume, and categories.',
    parameters: z.object({}),
    handler: async (client) => {
      // Prefer API for richer data (images, categories, volume); fall back to on-chain
      let markets = await client.getLiveMarketsFromApi().catch(() => null)
      if (!markets) {
        markets = await client.getLiveMarkets()
      }
      return { markets: markets.map(formatMarket) }
    },
  },
  {
    name: 'get_market',
    description:
      'Get details for a single prediction market by ID. Accepts an app ID (number as string) or UUID.',
    parameters: z.object({
      marketId: z.string().describe('Market ID — app ID as string or UUID'),
    }),
    handler: async (client, args) => {
      // Prefer API for richer data; fall back to on-chain for app IDs
      let market = await client.getMarketFromApi(args.marketId).catch(() => null)
      if (!market && /^\d+$/.test(args.marketId)) {
        market = await client.getMarketOnChain(Number(args.marketId))
      }
      if (!market) return { error: `Market not found: ${args.marketId}` }
      return formatMarket(market)
    },
  },
  {
    name: 'get_orderbook',
    description:
      'Get the on-chain orderbook for a prediction market. Shows YES and NO bids/asks with prices and quantities.',
    parameters: z.object({
      marketAppId: z.number().describe('The market app ID'),
    }),
    handler: async (client, args) => {
      const orderbook = await client.getOrderbook(args.marketAppId)
      return formatOrderbook(orderbook)
    },
  },
  {
    name: 'get_positions',
    description:
      'Get all prediction market positions (YES/NO token balances) for a wallet address.',
    parameters: z.object({
      walletAddress: z.string().describe('Algorand wallet address'),
    }),
    handler: async (client, args) => {
      const positions = await client.getPositions(args.walletAddress)
      return { positions: positions.map(formatPosition) }
    },
  },
  {
    name: 'get_open_orders',
    description: 'Get open orders for a wallet on a specific prediction market.',
    parameters: z.object({
      marketAppId: z.number().describe('The market app ID'),
      walletAddress: z.string().describe('Algorand wallet address'),
    }),
    handler: async (client, args) => {
      const orders = await client.getOpenOrders(args.marketAppId, args.walletAddress)
      return { orders: orders.map(formatOpenOrder) }
    },
  },
]
