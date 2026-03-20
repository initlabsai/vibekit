import { z, type ZodSchema } from 'zod'
import type { AlphaClient, Market, Orderbook, WalletPosition, OpenOrder } from '@alpha-arcade/sdk'
import { microToDollars, microToShares, probToDollars } from './format'

export interface AlphaArcadeToolDefinition {
  name: string
  description: string
  parameters: ZodSchema
  handler: (client: AlphaClient, args: any) => Promise<unknown>
}

function formatMarket(m: Market) {
  return {
    id: m.id,
    title: m.title,
    slug: m.slug,
    image: m.image,
    marketAppId: m.marketAppId,
    yesAssetId: m.yesAssetId,
    noAssetId: m.noAssetId,
    yesPrice: m.yesProb != null ? probToDollars(m.yesProb) : undefined,
    noPrice: m.noProb != null ? probToDollars(m.noProb) : undefined,
    volume: m.volume,
    endTs: m.endTs,
    isResolved: m.isResolved,
    categories: m.categories,
    featured: m.featured,
    options: m.options?.map((o) => ({
      id: o.id,
      title: o.title,
      marketAppId: o.marketAppId,
      yesPrice: probToDollars(o.yesProb),
      noPrice: probToDollars(o.noProb),
    })),
    source: m.source,
  }
}

function formatOrderbook(ob: Orderbook) {
  const formatEntry = (e: { price: number; quantity: number; escrowAppId: number; owner: string }) => ({
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

function formatPosition(p: WalletPosition) {
  return {
    marketAppId: p.marketAppId,
    title: p.title,
    yesAssetId: p.yesAssetId,
    noAssetId: p.noAssetId,
    yesBalance: microToShares(p.yesBalance),
    noBalance: microToShares(p.noBalance),
  }
}

function formatOpenOrder(o: OpenOrder) {
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

export const alphaArcadeTools: AlphaArcadeToolDefinition[] = [
  {
    name: 'get_live_markets',
    description:
      'Get all live prediction markets on Alpha Arcade. Returns market titles, current YES/NO prices, volume, and categories.',
    parameters: z.object({}),
    handler: async (client) => {
      const markets = await client.getLiveMarkets()
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
      const market = await client.getMarket(args.marketId)
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
    description:
      'Get open orders for a wallet on a specific prediction market.',
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
