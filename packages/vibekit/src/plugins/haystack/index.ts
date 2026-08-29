/**
 * Haystack plugin: swaps over txnlab's order router, which routes one order
 * across Tinyman, Pact, Folks, and the liquid-staking pools. Quotes are reads;
 * a swap composes the router's group for the wallet — the router's own legs
 * arrive signed by its logicsig and ride along as `presigned`, the user's
 * input leg stays unsigned. Mainnet only. Needs an API key.
 */
import algosdk from 'algosdk'
import { RouterClient, type SwapQuote as RouterQuote } from '@txnlab/haystack-router'
import { z } from 'zod'

import {
  bytesToBase64,
  defineTool,
  ToolError,
  type AnyTool,
  type ToolContext,
  type ToolPlugin,
  type UnsignedGroupResult,
} from '../../core/index.js'
import { writeResultSchema } from '../../core/schemas.js'
import { swapQuoteSchema, type SwapQuote } from './schemas.js'

export { swapQuoteSchema, type SwapQuote }

export const PLUGIN_NAME = 'haystack'

export interface HaystackOptions {
  /** Router API key — the free tier from the README for development, your own in production. */
  apiKey: string
  /** Receives a share of the router fee on every swap. */
  referrerAddress?: string
}

/** The router, built per network config so the server routes against the host's algod. */
export interface HaystackService {
  routerFor(ctx: ToolContext): RouterClient
}

function createHaystackService(options: HaystackOptions): HaystackService {
  const clients = new Map<string, RouterClient>()
  return {
    routerFor(ctx) {
      const key = ctx.network.algod.url
      let client = clients.get(key)
      if (!client) {
        client = new RouterClient({
          apiKey: options.apiKey,
          algodUri: ctx.network.algod.url,
          algodToken: ctx.network.algod.token ?? '',
          algodPort: ctx.network.algod.port ?? 443,
          ...(options.referrerAddress ? { referrerAddress: options.referrerAddress } : {}),
          autoOptIn: true,
        })
        clients.set(key, client)
      }
      return client
    },
  }
}

/** Typed accessor for ctx.services; mainnet only. */
export function getHaystack(ctx: ToolContext): HaystackService {
  const service = ctx.services[PLUGIN_NAME] as HaystackService | undefined
  if (!service) {
    throw new ToolError(
      'PLUGIN_NOT_CONFIGURED',
      'The haystack plugin is not registered in this deployment',
    )
  }
  if (ctx.network.id !== 'mainnet') {
    throw new ToolError(
      'UNSUPPORTED_NETWORK',
      `Swaps run on mainnet only, not ${ctx.network.id} — switch networks`,
    )
  }
  return service
}

interface AssetFacts {
  decimals: number
  unit: string
}

/** Decimals and unit for scaling; ALGO needs no lookup. */
async function assetFacts(ctx: ToolContext, assetId: number): Promise<AssetFacts> {
  if (assetId === 0) return { decimals: 6, unit: 'ALGO' }
  const { params } = await ctx.algod.getAssetByID(assetId).do()
  return { decimals: Number(params?.decimals ?? 0), unit: params?.unitName ?? `asset ${assetId}` }
}

/** "10.5" of a 6-decimal asset → 10500000n. Refuses more fraction digits than the asset has. */
export function toBaseUnits(amount: string, decimals: number): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim())
  if (!match) throw new ToolError('INVALID_AMOUNT', `Amount "${amount}" is not a plain decimal`)
  const [, whole, fraction = ''] = match
  if (fraction.length > decimals) {
    throw new ToolError('INVALID_AMOUNT', `Amount "${amount}" has more than ${decimals} decimals`)
  }
  return BigInt(whole! + fraction.padEnd(decimals, '0'))
}

const swapArgs = {
  fromAssetId: z.number().describe('Asset to sell (0 = ALGO)'),
  toAssetId: z.number().describe('Asset to buy (0 = ALGO)'),
  amount: z.string().describe('Amount in the asset\'s own units, e.g. "10" or "2.5"'),
}

function routeLegs(quote: RouterQuote): SwapQuote['route'] {
  return Object.entries(quote.flattenedRoute)
    .map(([venue, percentage]) => ({ venue, percentage }))
    .sort((a, b) => b.percentage - a.percentage)
}

async function fetchQuote(
  ctx: ToolContext,
  args: {
    fromAssetId: number
    toAssetId: number
    amount: string
    type?: 'fixed-input' | 'fixed-output'
    sender?: string
  },
): Promise<{ quote: RouterQuote; view: SwapQuote; from: AssetFacts; to: AssetFacts }> {
  const router = getHaystack(ctx).routerFor(ctx)
  const [from, to] = await Promise.all([
    assetFacts(ctx, args.fromAssetId),
    assetFacts(ctx, args.toAssetId),
  ])
  const type = args.type ?? 'fixed-input'
  const amount = toBaseUnits(args.amount, type === 'fixed-input' ? from.decimals : to.decimals)
  const quote = await router.newQuote({
    fromASAID: args.fromAssetId,
    toASAID: args.toAssetId,
    amount,
    type,
    ...(args.sender ? { address: args.sender } : {}),
  })
  const needsOptIn =
    args.sender !== undefined && args.toAssetId !== 0
      ? await router.needsAssetOptIn(args.sender, args.toAssetId)
      : false
  const amountIn = type === 'fixed-input' ? amount : BigInt(quote.quote)
  const amountOut = type === 'fixed-input' ? BigInt(quote.quote) : amount
  return {
    quote,
    from,
    to,
    view: {
      fromAssetId: args.fromAssetId,
      toAssetId: args.toAssetId,
      fromDecimals: from.decimals,
      toDecimals: to.decimals,
      fromUnit: from.unit,
      toUnit: to.unit,
      type,
      amountIn: amountIn.toString(),
      amountOut: amountOut.toString(),
      ...(quote.userPriceImpact === undefined ? {} : { priceImpactPercent: quote.userPriceImpact }),
      ...(Number.isFinite(quote.usdIn) ? { usdIn: quote.usdIn } : {}),
      ...(Number.isFinite(quote.usdOut) ? { usdOut: quote.usdOut } : {}),
      route: routeLegs(quote),
      needsOptIn,
    },
  }
}

/** The signer the composer never calls in compose mode; execute mode swaps it for the keystore's. */
const refuseToSign: algosdk.TransactionSigner = async () => {
  throw new ToolError('SIGNER_UNAVAILABLE', 'Compose mode never signs; the wallet does')
}

export const haystackTools: AnyTool[] = [
  defineTool({
    name: 'get_swap_quote',
    description:
      'Best swap route and price for selling one asset for another on mainnet (Tinyman, Pact, Folks, LSTs via Haystack). Quote first; swap only when the user says go.',
    parameters: z.object({
      ...swapArgs,
      type: z
        .enum(['fixed-input', 'fixed-output'])
        .optional()
        .describe('Default fixed-input: amount is what you sell'),
      sender: z.string().optional().describe('The buyer, to check the opt-in'),
    }),
    output: swapQuoteSchema,
    view: 'haystack.quote',
    handler: async (ctx, args) => (await fetchQuote(ctx, args)).view,
  }),
  defineTool({
    name: 'swap',
    description:
      'Compose the swap from get_swap_quote for the wallet to sign (mainnet). Never call it unasked; the user approves the group on screen.',
    parameters: z.object({
      ...swapArgs,
      sender: z.string().describe('The account that sells and receives'),
      slippagePercent: z.number().min(0).max(50).optional().describe('Default 1'),
    }),
    output: writeResultSchema,
    requiresSigner: true,
    view: 'txn',
    handler: async (
      ctx,
      args,
    ): Promise<UnsignedGroupResult | { txids: string[]; confirmedRound: number; returns: [] }> => {
      const slippage = args.slippagePercent ?? 1
      const { quote, view, from, to } = await fetchQuote(ctx, { ...args, sender: args.sender })
      const router = getHaystack(ctx).routerFor(ctx)
      const signer =
        ctx.mode === 'execute' && ctx.resolveSigner
          ? await ctx.resolveSigner(args.sender)
          : refuseToSign
      const composer = await router.newSwap({ quote, address: args.sender, slippage, signer })
      await composer.addSwapTransactions()
      if (ctx.mode === 'execute') {
        const result = await composer.execute()
        return { txids: result.txIds, confirmedRound: Number(result.confirmedRound), returns: [] }
      }
      const group = composer.buildGroup()
      const txns = group.map((entry) => entry.txn)
      // The user's own legs stay unsigned; every other leg is the router's and it signs now
      // with the logicsig or key the API attached — none of it is the user's authority.
      const presigned = await Promise.all(
        group.map(async (entry, index) =>
          entry.txn.sender.toString() === args.sender
            ? null
            : bytesToBase64((await entry.signer(txns, [index]))[0]!),
        ),
      )
      const minOut = (BigInt(view.amountOut) * BigInt(Math.round((100 - slippage) * 100))) / 10000n
      const scale = (base: string, decimals: number) => {
        const text = base.padStart(decimals + 1, '0')
        return decimals === 0
          ? text
          : `${text.slice(0, -decimals)}.${text.slice(-decimals)}`.replace(/\.?0+$/, '')
      }
      return {
        unsignedGroup: txns.map((txn) => bytesToBase64(algosdk.encodeUnsignedTransaction(txn))),
        summary: `swap ${scale(view.amountIn, from.decimals)} ${from.unit} → ${scale(view.amountOut, to.decimals)} ${to.unit} via ${view.route.map((leg) => leg.venue).join(' + ')}`,
        presigned,
        intent: {
          kind: 'swap',
          fromAssetId: args.fromAssetId,
          toAssetId: args.toAssetId,
          fromUnit: from.unit,
          toUnit: to.unit,
          fromDecimals: from.decimals,
          toDecimals: to.decimals,
          amountIn: view.amountIn,
          amountOut: view.amountOut,
          minAmountOut: minOut.toString(),
          slippagePercent: slippage,
          ...(view.priceImpactPercent === undefined
            ? {}
            : { priceImpactPercent: view.priceImpactPercent }),
          ...(view.usdIn === undefined ? {} : { usdIn: view.usdIn }),
          ...(view.usdOut === undefined ? {} : { usdOut: view.usdOut }),
          route: view.route,
        },
      }
    },
  }),
]

/** The plugin factory — `plugins: [haystackPlugin({ apiKey })]`. */
export function haystackPlugin(options: HaystackOptions): ToolPlugin {
  return {
    name: PLUGIN_NAME,
    description:
      'Haystack swaps — best-route quotes across Algorand DEXs, swaps for the wallet to sign (mainnet)',
    tools: haystackTools,
    service: createHaystackService(options),
    views: { 'haystack.quote': swapQuoteSchema },
  }
}
