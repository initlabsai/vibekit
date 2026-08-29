/**
 * Alpha Arcade plugin: prediction-market read tools over @alpha-arcade/sdk.
 * The protocol lives on Algorand mainnet; the client is mainnet-fixed and
 * read-only (dummy signer — read methods never sign).
 */
import {
  defineTool,
  ToolError,
  type AnyTool,
  type ToolContext,
  type ToolPlugin,
} from '../../core/index.js'
import { AlphaClient } from '@alpha-arcade/sdk'
import algosdk from 'algosdk'
import { z } from 'zod'
import { formatMarket, formatOpenOrder, formatOrderbook, formatPosition } from './format.js'
import {
  marketSchema,
  marketsSchema,
  openOrdersSchema,
  orderbookSchema,
  positionsSchema,
} from './schemas.js'

export * from './schemas.js'

export { microToShares, microToUsd } from './format.js'
export type {
  FormattedMarket,
  FormattedOpenOrder,
  FormattedOrderbook,
  FormattedPosition,
} from './format.js'

export const PLUGIN_NAME = 'alpha-arcade'

const MAINNET_MATCHER_APP_ID = 3078581851
const MAINNET_USDC_ASSET_ID = 31566704

export interface AlphaArcadeOptions {
  apiKey?: string
}

function createAlphaClient(options: AlphaArcadeOptions): AlphaClient {
  const dummySigner: algosdk.TransactionSigner = async () => []
  return new AlphaClient({
    algodClient: new algosdk.Algodv2('', 'https://mainnet-api.4160.nodely.dev', 443),
    indexerClient: new algosdk.Indexer('', 'https://mainnet-idx.4160.nodely.dev', 443),
    signer: dummySigner,
    activeAddress: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    matcherAppId: MAINNET_MATCHER_APP_ID,
    usdcAssetId: MAINNET_USDC_ASSET_ID,
    ...(options.apiKey && { apiKey: options.apiKey }),
  })
}

/** Typed accessor for ctx.services. */
export function getAlphaClient(ctx: ToolContext): AlphaClient {
  const client = ctx.services[PLUGIN_NAME] as AlphaClient | undefined
  if (!client) {
    throw new ToolError(
      'PLUGIN_NOT_CONFIGURED',
      'The alpha-arcade plugin is not registered in this deployment',
    )
  }
  return client
}

export const alphaArcadeTools: AnyTool[] = [
  defineTool({
    name: 'get_live_markets',
    description:
      'Live prediction markets on Alpha Arcade (mainnet): title, YES/NO price = implied probability, volume, close time. Filter by category, cap with limit.',
    parameters: z.object({
      category: z.string().optional().describe('Only markets in this category (case-insensitive)'),
      limit: z.number().optional().describe('Max markets (default 20, max 100)'),
    }),
    output: marketsSchema,
    view: 'arcade.markets',
    handler: async (ctx, args) => {
      const client = getAlphaClient(ctx)
      let markets = await client.getLiveMarketsFromApi().catch(() => null)
      if (!markets) markets = await client.getLiveMarkets()
      const wanted = args.category?.toLowerCase()
      const rows = markets
        .map(formatMarket)
        .filter((m) => !wanted || m.categories?.some((c) => c.toLowerCase() === wanted))
        .sort((a, b) => (b.volumeUsd ?? 0) - (a.volumeUsd ?? 0))
      return { markets: rows.slice(0, Math.min(args.limit ?? 20, 100)), total: rows.length }
    },
  }),
  defineTool({
    name: 'get_market',
    description: 'One Alpha Arcade market by app id or UUID: prices, volume, close time, options.',
    parameters: z.object({
      marketId: z.string().describe('Market ID — app ID as string or UUID'),
    }),
    output: marketSchema,
    view: 'arcade.market',
    handler: async (ctx, args) => {
      const client = getAlphaClient(ctx)
      let market = await client.getMarketFromApi(args.marketId).catch(() => null)
      if (!market && /^\d+$/.test(args.marketId)) {
        market = await client.getMarketOnChain(Number(args.marketId))
      }
      if (!market) {
        throw new ToolError('MARKET_NOT_FOUND', `Market not found: ${args.marketId}`)
      }
      return formatMarket(market)
    },
  }),
  defineTool({
    name: 'get_orderbook',
    description:
      'The on-chain orderbook of an Alpha Arcade market: YES and NO bids and asks in USD and shares.',
    parameters: z.object({
      marketAppId: z.number().describe('The market app ID'),
    }),
    output: orderbookSchema,
    view: 'arcade.orderbook',
    handler: async (ctx, args) => ({
      marketAppId: args.marketAppId,
      ...formatOrderbook(await getAlphaClient(ctx).getOrderbook(args.marketAppId)),
    }),
  }),
  defineTool({
    name: 'get_positions',
    description:
      "An account's Alpha Arcade positions — YES/NO share balances per market. Default to the active account.",
    parameters: z.object({
      walletAddress: z.string().describe('Algorand wallet address'),
    }),
    output: positionsSchema,
    view: 'arcade.positions',
    handler: async (ctx, args) => ({
      walletAddress: args.walletAddress,
      positions: (await getAlphaClient(ctx).getPositions(args.walletAddress)).map(formatPosition),
    }),
  }),
  defineTool({
    name: 'get_open_orders',
    description:
      "An account's open orders on one Alpha Arcade market. Default to the active account.",
    parameters: z.object({
      marketAppId: z.number().describe('The market app ID'),
      walletAddress: z.string().describe('Algorand wallet address'),
    }),
    output: openOrdersSchema,
    view: 'arcade.orders',
    handler: async (ctx, args) => ({
      marketAppId: args.marketAppId,
      walletAddress: args.walletAddress,
      orders: (await getAlphaClient(ctx).getOpenOrders(args.marketAppId, args.walletAddress)).map(
        formatOpenOrder,
      ),
    }),
  }),
]

/** The plugin factory — `plugins: [alphaArcadePlugin({ apiKey })]`. */
export function alphaArcadePlugin(options: AlphaArcadeOptions = {}): ToolPlugin {
  return {
    name: PLUGIN_NAME,
    description: 'Alpha Arcade prediction markets — prices, orderbooks, positions (mainnet)',
    tools: alphaArcadeTools,
    service: createAlphaClient(options),
    views: {
      'arcade.markets': marketsSchema,
      'arcade.market': marketSchema,
      'arcade.orderbook': orderbookSchema,
      'arcade.positions': positionsSchema,
      'arcade.orders': openOrdersSchema,
    },
  }
}
