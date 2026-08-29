/**
 * Alpha Arcade plugin: prediction-market read tools over @alpha-arcade/sdk.
 * The protocol lives on Algorand mainnet; the client is mainnet-fixed and
 * read-only (dummy signer — read methods never sign).
 */
import {
  bytesToBase64,
  defineTool,
  ToolError,
  writeResultSchema,
  type AnyTool,
  type ToolContext,
  type ToolPlugin,
  type UnsignedGroupResult,
} from '../../core/index.js'
import { AlphaClient, type Market, type Position } from '@alpha-arcade/sdk'
import algosdk from 'algosdk'
import { z } from 'zod'
import {
  formatMarket,
  formatOpenOrder,
  formatOrderbook,
  formatPosition,
  marketFromCachedFeed,
  type CachedFeedMarket,
} from './format.js'
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

const MAINNET_ALGOD = 'https://mainnet-api.4160.nodely.dev'
const MAINNET_INDEXER = 'https://mainnet-idx.4160.nodely.dev'

function clientWith(
  options: AlphaArcadeOptions,
  activeAddress: string,
  signer: algosdk.TransactionSigner,
): AlphaClient {
  return new AlphaClient({
    algodClient: new algosdk.Algodv2('', MAINNET_ALGOD, 443),
    indexerClient: new algosdk.Indexer('', MAINNET_INDEXER, 443),
    signer,
    activeAddress,
    matcherAppId: MAINNET_MATCHER_APP_ID,
    usdcAssetId: MAINNET_USDC_ASSET_ID,
    ...(options.apiKey && { apiKey: options.apiKey }),
  })
}

/** The read client, shared; a trading client per sender and signer. */
export interface AlphaService {
  read: AlphaClient
  trading(activeAddress: string, signer: algosdk.TransactionSigner): AlphaClient
  /** Every market, from the API when keyed, else the on-chain scan — which is slow, so it is kept a minute. */
  markets(): Promise<Market[]>
}

const MARKETS_TTL_MS = 60_000
const API_BASE_URL = 'https://platform.alphaarcade.com/api'
const FEED_PAGE = 300
const FEED_MAX_PAGES = 10

/** Every live market from `get-live-markets-cached`, following `lastEvaluatedKey`; hidden ones dropped. */
/** Cached feed, then the SDK's route, then the chain — the first that answers. */
async function fetchMarkets(options: AlphaArcadeOptions, read: AlphaClient): Promise<Market[]> {
  if (options.apiKey) {
    try {
      return await cachedFeed(options.apiKey)
    } catch {
      /* the SDK's route next */
    }
    try {
      return await read.getLiveMarketsFromApi()
    } catch {
      /* the chain always knows */
    }
  }
  // ponytail: the keyless path scans every market app through the indexer (~2000 and
  // counting, no prices); getLiveMarkets() would take the API again when a key is set.
  return read.getMarketsOnChain()
}

export async function cachedFeed(apiKey: string, baseUrl = API_BASE_URL): Promise<Market[]> {
  const markets: Market[] = []
  let cursor: string | undefined
  for (let page = 0; page < FEED_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ limit: String(FEED_PAGE) })
    if (cursor) params.set('lastEvaluatedKey', cursor)
    const response = await fetch(`${baseUrl}/get-live-markets-cached?${params}`, {
      headers: { 'x-api-key': apiKey },
    })
    if (!response.ok) throw new ToolError('ALPHA_API_ERROR', `Alpha API ${response.status}`)
    const data = (await response.json()) as {
      markets?: CachedFeedMarket[]
      lastEvaluatedKey?: string
    }
    for (const raw of data.markets ?? []) {
      if (raw.hidden) continue
      const market = marketFromCachedFeed(raw)
      if (market) markets.push(market)
    }
    cursor = typeof data.lastEvaluatedKey === 'string' ? data.lastEvaluatedKey : undefined
    if (!cursor) break
  }
  return markets
}

function createAlphaService(options: AlphaArcadeOptions): AlphaService {
  const dummySigner: algosdk.TransactionSigner = async () => []
  const read = clientWith(
    options,
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    dummySigner,
  )
  let cached: { at: number; markets: Promise<Market[]> } | undefined
  return {
    read,
    trading: (activeAddress, signer) => clientWith(options, activeAddress, signer),
    markets() {
      // One list a minute per process, whichever source produced it: the pages a card asks
      // for are slices of this list, so "more" never re-fetches or re-sorts.
      if (!cached || Date.now() - cached.at > MARKETS_TTL_MS) {
        const markets = fetchMarkets(options, read).catch((error: unknown) => {
          cached = undefined
          throw error
        })
        cached = { at: Date.now(), markets }
      }
      return cached.markets
    },
  }
}

function getAlphaService(ctx: ToolContext): AlphaService {
  const service = ctx.services[PLUGIN_NAME] as AlphaService | undefined
  if (!service) {
    throw new ToolError(
      'PLUGIN_NOT_CONFIGURED',
      'The alpha-arcade plugin is not registered in this deployment',
    )
  }
  if (ctx.network.id !== 'mainnet') {
    throw new ToolError(
      'UNSUPPORTED_NETWORK',
      `Alpha Arcade lives on mainnet, not ${ctx.network.id} — switch networks`,
    )
  }
  return service
}

/** Typed accessor for ctx.services: the read client. */
export function getAlphaClient(ctx: ToolContext): AlphaClient {
  return getAlphaService(ctx).read
}

/** Thrown by the dry-run signer with the group the SDK built; nothing was submitted. */
class CapturedGroup extends Error {
  constructor(readonly txns: algosdk.Transaction[]) {
    super('captured')
  }
}

// ponytail: the SDK has no build-only path (0.4.11) — it composes, signs, and submits in one
// call with no side effect before signing, so a signer that keeps the group and throws is a
// clean stop. Replace with the SDK's compose method the day it grows one.
async function captureGroup(
  run: (signer: algosdk.TransactionSigner) => Promise<unknown>,
): Promise<algosdk.Transaction[]> {
  const signer: algosdk.TransactionSigner = async (txns) => {
    throw new CapturedGroup(txns)
  }
  try {
    await run(signer)
  } catch (error) {
    if (error instanceof CapturedGroup) return error.txns
    throw error
  }
  throw new ToolError('NO_GROUP', 'The SDK submitted nothing and signed nothing')
}

/**
 * Runs one SDK write: in execute mode with the sender's real signer; in compose
 * mode as a dry run whose group becomes the unsigned wire for the wallet.
 */
async function composeOrExecuteWrite(
  ctx: ToolContext,
  sender: string,
  summary: string,
  intent: UnsignedGroupResult['intent'],
  run: (client: AlphaClient) => Promise<{ txIds: string[]; confirmedRound: number }>,
): Promise<UnsignedGroupResult | { txids: string[]; confirmedRound: number; returns: [] }> {
  const service = getAlphaService(ctx)
  if (ctx.mode === 'execute') {
    if (!ctx.resolveSigner)
      throw new ToolError('SIGNER_UNAVAILABLE', 'No signer for this deployment')
    const result = await run(service.trading(sender, await ctx.resolveSigner(sender)))
    return { txids: result.txIds, confirmedRound: Number(result.confirmedRound), returns: [] }
  }
  const txns = await captureGroup((signer) => run(service.trading(sender, signer)))
  return {
    unsignedGroup: txns.map((txn) => bytesToBase64(algosdk.encodeUnsignedTransaction(txn))),
    summary,
    ...(intent ? { intent } : {}),
  }
}

const MICRO = 1_000_000
const marketIdArg = z.string().describe('Market app ID as a string, or its UUID')

async function marketFor(ctx: ToolContext, marketId: string) {
  // The list we already hold has prices, images, and volume; the per-market routes often do not.
  const listed = await Promise.resolve()
    .then(() => getAlphaService(ctx).markets())
    .then((markets) =>
      markets.find(
        (m) =>
          String(m.marketAppId) === marketId ||
          m.id === marketId ||
          m.slug === marketId ||
          m.options?.some((o) => String(o.marketAppId) === marketId),
      ),
    )
    .catch(() => undefined)
  if (listed) return listed
  const client = getAlphaClient(ctx)
  let market = await client.getMarketFromApi(marketId).catch(() => null)
  if (!market && /^\d+$/.test(marketId)) market = await client.getMarketOnChain(Number(marketId))
  if (!market) throw new ToolError('MARKET_NOT_FOUND', `Market not found: ${marketId}`)
  return market
}

export const alphaArcadeTools: AnyTool[] = [
  defineTool({
    name: 'get_live_markets',
    description:
      'Live prediction markets on Alpha Arcade (mainnet): title, YES/NO price = implied probability, volume, close time. Filter by category, cap with limit.',
    parameters: z.object({
      category: z.string().optional().describe('Only markets in this category (case-insensitive)'),
      limit: z.number().optional().describe('Max markets (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token from the previous page'),
    }),
    output: marketsSchema,
    view: 'arcade.markets',
    handler: async (ctx, args) => {
      const markets = await getAlphaService(ctx).markets()
      const wanted = args.category?.toLowerCase()
      const rows = markets
        .map(formatMarket)
        // The on-chain list is every market ever; live means activated and unresolved.
        .filter((m) => m.isLive !== false && !m.isResolved)
        .filter((m) => !wanted || m.categories?.some((c) => c.toLowerCase() === wanted))
        .sort((a, b) => (b.volumeUsd ?? 0) - (a.volumeUsd ?? 0))
      const limit = Math.min(args.limit ?? 20, 100)
      const offset = /^\d+$/.test(args.nextToken ?? '') ? Number(args.nextToken) : 0
      const page = rows.slice(offset, offset + limit)
      const end = offset + page.length
      return {
        markets: page,
        total: rows.length,
        ...(end < rows.length ? { nextToken: String(end) } : {}),
      }
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
    handler: async (ctx, args) => formatMarket(await marketFor(ctx, args.marketId)),
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
  defineTool({
    name: 'place_order',
    description:
      'Compose an Alpha Arcade order for the wallet to sign (mainnet): buy or sell YES/NO shares; a limit order at a price, a market order without one. Never call it unasked.',
    parameters: z.object({
      marketId: marketIdArg,
      side: z.enum(['yes', 'no']),
      action: z.enum(['buy', 'sell']),
      quantity: z.number().positive().describe('Shares (each pays $1 if right)'),
      priceUsd: z
        .number()
        .min(0.01)
        .max(0.99)
        .optional()
        .describe('Limit price per share in USD; omit for a market order'),
      slippagePercent: z
        .number()
        .min(0)
        .max(50)
        .optional()
        .describe('Market orders only; default 2'),
      sender: z.string().describe('The account that trades'),
    }),
    output: writeResultSchema,
    requiresSigner: true,
    view: 'txn',
    handler: async (ctx, args) => {
      const market = await marketFor(ctx, args.marketId)
      const position: Position = args.side === 'yes' ? 1 : 0
      const orderType = args.priceUsd === undefined ? 'market' : 'limit'
      const quoted = args.side === 'yes' ? market.yesProb : market.noProb
      const priceUsd = args.priceUsd ?? quoted
      if (priceUsd === undefined) {
        throw new ToolError('NO_PRICE', 'The market has no price yet — give a limit price')
      }
      const slippage = args.slippagePercent ?? 2
      const summary = `${args.action} ${args.quantity} ${args.side.toUpperCase()} @ $${priceUsd.toFixed(2)} on market ${market.marketAppId} (${market.title})${orderType === 'market' ? ` · market order, ${slippage}% slippage` : ''}`
      const intent: UnsignedGroupResult['intent'] = {
        kind: 'order',
        marketAppId: market.marketAppId,
        title: market.title,
        side: args.side,
        action: args.action,
        orderType,
        priceUsd,
        quantity: args.quantity,
        totalUsd: Math.round(priceUsd * args.quantity * 100) / 100,
        ...(orderType === 'market' ? { slippagePercent: slippage } : {}),
      }
      const params = {
        marketAppId: market.marketAppId,
        position,
        price: Math.round(priceUsd * MICRO),
        quantity: Math.round(args.quantity * MICRO),
        isBuying: args.action === 'buy',
      }
      return composeOrExecuteWrite(ctx, args.sender, summary, intent, (client) =>
        orderType === 'market'
          ? client.createMarketOrder({
              ...params,
              slippage: Math.round(((priceUsd * slippage) / 100) * MICRO),
            })
          : client.createLimitOrder(params),
      )
    },
  }),
  defineTool({
    name: 'cancel_order',
    description:
      'Compose the cancellation of one open Alpha Arcade order (by escrow app id) for the wallet to sign.',
    parameters: z.object({
      marketAppId: z.number(),
      escrowAppId: z.number().describe('From get_open_orders'),
      sender: z.string().describe("The order's owner"),
    }),
    output: writeResultSchema,
    requiresSigner: true,
    view: 'txn',
    handler: async (ctx, args) =>
      composeOrExecuteWrite(
        ctx,
        args.sender,
        `cancel order ${args.escrowAppId} on market ${args.marketAppId}`,
        undefined,
        (client) =>
          client.cancelOrder({
            marketAppId: args.marketAppId,
            escrowAppId: args.escrowAppId,
            orderOwner: args.sender,
          }),
      ),
  }),
  defineTool({
    name: 'claim_winnings',
    description:
      "Compose the claim of a resolved Alpha Arcade market's winning shares for the wallet to sign.",
    parameters: z.object({
      marketId: marketIdArg,
      side: z.enum(['yes', 'no']).describe('Which shares the account holds'),
      sender: z.string().describe('The account that claims'),
    }),
    output: writeResultSchema,
    requiresSigner: true,
    view: 'txn',
    handler: async (ctx, args) => {
      const market = await marketFor(ctx, args.marketId)
      if (!market.isResolved)
        throw new ToolError('NOT_RESOLVED', `Market ${market.marketAppId} has not resolved yet`)
      const assetId = args.side === 'yes' ? market.yesAssetId : market.noAssetId
      return composeOrExecuteWrite(
        ctx,
        args.sender,
        `claim ${args.side.toUpperCase()} winnings on market ${market.marketAppId} (${market.title})`,
        undefined,
        (client) => client.claim({ marketAppId: market.marketAppId, assetId }),
      )
    },
  }),
]

/** The plugin factory — `plugins: [alphaArcadePlugin({ apiKey })]`. */
export function alphaArcadePlugin(options: AlphaArcadeOptions = {}): ToolPlugin {
  return {
    name: PLUGIN_NAME,
    description: 'Alpha Arcade prediction markets — prices, orderbooks, positions (mainnet)',
    tools: alphaArcadeTools,
    service: createAlphaService(options),
    views: {
      'arcade.markets': marketsSchema,
      'arcade.market': marketSchema,
      'arcade.orderbook': orderbookSchema,
      'arcade.positions': positionsSchema,
      'arcade.orders': openOrdersSchema,
    },
  }
}
