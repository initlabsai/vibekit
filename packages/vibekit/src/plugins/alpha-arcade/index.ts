/**
 * Alpha Arcade plugin: prediction-market read tools over @alpha-arcade/sdk.
 * The protocol lives on Algorand mainnet; the client is mainnet-fixed and
 * read-only (dummy signer — read methods never sign).
 */
import { defineTool, ToolError, type AnyTool, type ToolContext, type ToolPlugin } from '../../core/index.js'
import { AlphaClient } from '@alpha-arcade/sdk'
import algosdk from 'algosdk'
import { z } from 'zod'
import { formatMarket, formatOpenOrder, formatOrderbook, formatPosition } from './format.js'

export { microToShares, microToUsd } from './format.js'
export type { FormattedMarket, FormattedOpenOrder, FormattedOrderbook, FormattedPosition } from './format.js'

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
    throw new ToolError('PLUGIN_NOT_CONFIGURED', 'The alpha-arcade plugin is not registered in this deployment')
  }
  return client
}

export const alphaArcadeTools: AnyTool[] = [
  defineTool({
    name: 'get_live_markets',
    description:
      'Get all live prediction markets on Alpha Arcade (Algorand mainnet). Prices are raw numbers: yesPriceUsd=0.65 means $0.65 = 65% implied probability. All Usd-suffixed fields are already USD — never convert them.',
    parameters: z.object({}),
    view: 'table',
    handler: async (ctx) => {
      const client = getAlphaClient(ctx)
      let markets = await client.getLiveMarketsFromApi().catch(() => null)
      if (!markets) markets = await client.getLiveMarkets()
      return { markets: markets.map(formatMarket) }
    },
  }),
  defineTool({
    name: 'get_market',
    description:
      'Get one prediction market by ID (app ID as string, or UUID). Prices raw USD numbers (yesPriceUsd/yesProb).',
    parameters: z.object({
      marketId: z.string().describe('Market ID — app ID as string or UUID'),
    }),
    view: 'json',
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
      'Get the on-chain orderbook for a prediction market: YES/NO bids and asks, priceUsd + share quantities.',
    parameters: z.object({
      marketAppId: z.number().describe('The market app ID'),
    }),
    view: 'table',
    handler: async (ctx, args) => formatOrderbook(await getAlphaClient(ctx).getOrderbook(args.marketAppId)),
  }),
  defineTool({
    name: 'get_positions',
    description: 'Get all prediction-market positions (YES/NO share balances) for a wallet address.',
    parameters: z.object({
      walletAddress: z.string().describe('Algorand wallet address'),
    }),
    view: 'table',
    handler: async (ctx, args) => ({
      positions: (await getAlphaClient(ctx).getPositions(args.walletAddress)).map(formatPosition),
    }),
  }),
  defineTool({
    name: 'get_open_orders',
    description: 'Get open orders for a wallet on a prediction market (priceUsd, quantities, slippageUsd).',
    parameters: z.object({
      marketAppId: z.number().describe('The market app ID'),
      walletAddress: z.string().describe('Algorand wallet address'),
    }),
    view: 'table',
    handler: async (ctx, args) => ({
      orders: (
        await getAlphaClient(ctx).getOpenOrders(args.marketAppId, args.walletAddress)
      ).map(formatOpenOrder),
    }),
  }),
] as AnyTool[]

/** The plugin factory — `plugins: [alphaArcadePlugin({ apiKey })]`. */
export function alphaArcadePlugin(options: AlphaArcadeOptions = {}): ToolPlugin {
  return {
    name: PLUGIN_NAME,
    tools: alphaArcadeTools,
    service: createAlphaClient(options),
  }
}
