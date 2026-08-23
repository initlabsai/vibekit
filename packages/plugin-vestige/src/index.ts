/**
 * Vestige plugin: market data the chain itself cannot answer — USD prices and
 * liquidity-ranked asset search — over the free Vestige Labs API (mainnet only).
 */
import { defineTool, ToolError, type AnyTool, type ToolContext, type ToolPlugin } from '@initlabs/vibekit-core'
import { z } from 'zod'

export const PLUGIN_NAME = 'vestige'

const BASE_URL = 'https://api.vestigelabs.org'
/** USDC — prices denominated in it read as USD. */
const USDC_ID = 31566704

export interface VestigeService {
  get(path: string, params: Record<string, string | number>): Promise<unknown>
}

function createVestigeService(baseUrl = BASE_URL): VestigeService {
  return {
    async get(path, params) {
      const url = new URL(path, baseUrl)
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
      const response = await fetch(url)
      if (!response.ok) {
        throw new ToolError('VESTIGE_ERROR', `Vestige API ${response.status} for ${path}`)
      }
      return response.json()
    },
  }
}

/** Typed accessor — the plugin-side pattern for reading ctx.services. */
export function getVestige(ctx: ToolContext): VestigeService {
  const service = ctx.services[PLUGIN_NAME] as VestigeService | undefined
  if (!service) {
    throw new ToolError('PLUGIN_NOT_CONFIGURED', 'The vestige plugin is not registered in this deployment')
  }
  if (ctx.network.id !== 'mainnet') {
    throw new ToolError('UNSUPPORTED_NETWORK', `Vestige serves mainnet only, not ${ctx.network.id}`)
  }
  return service
}

/**
 * Plain decimal string — JSON floats render tiny prices as 4.9e-8, which
 * models misread. String(n) is the shortest exact form; only its exponent
 * notation needs expanding, so no precision is chosen and no noise appears.
 */
function usd(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null
  const text = String(value)
  const match = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(text)
  if (!match) return text
  const [, sign, whole, fraction = '', exp] = match
  const digits = whole + fraction
  const point = whole.length + Number(exp)
  if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`
  if (point >= digits.length) return sign + digits + '0'.repeat(point - digits.length)
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`
}

const priceRowSchema = z.object({
  assetId: z.number(),
  priceUsd: z.string().describe('USD price as a plain decimal string'),
  confidence: z.number().describe('0..1 — Vestige’s trust in the price; treat < 0.5 as unreliable'),
})

/** get_asset_prices' wire shape (the `vestige.prices` view). */
export const assetPricesSchema = z.object({ prices: z.array(priceRowSchema) })
export type AssetPrices = z.infer<typeof assetPricesSchema>

/** search_assets_ranked's wire shape (the `vestige.markets` view). */
export const rankedAssetsSchema = z.object({
  assets: z.array(
    z.object({
      assetId: z.number(),
      rank: z.number().nullable().describe('Vestige activity rank; lower is bigger'),
      name: z.string().nullable(),
      ticker: z.string().nullable(),
      priceUsd: z.string().nullable().describe('USD price as a plain decimal string'),
      marketCapUsd: z.number().nullable(),
      tvlUsd: z.number().nullable(),
      volume1dUsd: z.number().nullable(),
    }),
  ),
})
export type RankedAssets = z.infer<typeof rankedAssetsSchema>

interface WirePrice {
  asset_id: number
  price: number
  confidence: number
}

interface WireSearchAsset {
  id: number
  rank: number | null
  name: string | null
  ticker: string | null
  decimals: number
  price: number | null
  price1d: number | null
  volume1d: number | null
  market_cap: number | null
  tvl: number | null
  confidence: number | null
}

export const vestigeTools: AnyTool[] = [
  defineTool({
    name: 'get_asset_prices',
    description:
      'Current USD prices for one or more Algorand assets (mainnet), from Vestige DEX data. Use for "what is X worth", market cap, or converting holdings to dollars. ALGO itself is asset 0.',
    parameters: z.object({
      assetIds: z.array(z.number()).min(1).max(50).describe('Asset IDs (0 = ALGO)'),
    }),
    output: assetPricesSchema,
    view: 'vestige.prices',
    handler: async (ctx: ToolContext, args: { assetIds: number[] }) => {
      const rows = (await getVestige(ctx).get('/assets/price', {
        asset_ids: args.assetIds.join(','),
        network_id: 0,
        denominating_asset_id: USDC_ID,
      })) as WirePrice[]
      return {
        prices: rows.map((row) => ({
          assetId: row.asset_id,
          priceUsd: usd(row.price) ?? '0',
          confidence: row.confidence,
        })),
      }
    },
  }),
  defineTool({
    name: 'search_assets_ranked',
    description:
      'Search Algorand assets by name/ticker, ranked by market activity (mainnet, via Vestige). Returns USD price, market cap, TVL, and 24h volume per hit — far better than indexer name search for "the real X" or trending/market questions.',
    parameters: z.object({
      query: z.string().min(1).describe('Name or ticker fragment'),
      limit: z.number().optional().describe('Max results (default 10, max 50)'),
    }),
    output: rankedAssetsSchema,
    view: 'vestige.markets',
    handler: async (ctx: ToolContext, args: { query: string; limit?: number }) => {
      const result = (await getVestige(ctx).get('/assets/search', {
        query: args.query,
        network_id: 0,
        denominating_asset_id: USDC_ID,
        limit: Math.min(args.limit ?? 10, 50),
        order_by: 'rank',
        order_dir: 'asc',
      })) as { results: WireSearchAsset[] }
      return {
        assets: (result.results ?? []).map((a) => ({
          assetId: a.id,
          rank: a.rank,
          name: a.name,
          ticker: a.ticker,
          priceUsd: usd(a.price),
          marketCapUsd: a.market_cap,
          tvlUsd: a.tvl,
          volume1dUsd: a.volume1d,
        })),
      }
    },
  }),
]

/** The plugin factory — `plugins: [vestigePlugin()]` in deployment options. */
export function vestigePlugin(baseUrl?: string): ToolPlugin {
  return {
    name: PLUGIN_NAME,
    description: 'Vestige market data — USD prices, ranked asset search (mainnet)',
    tools: vestigeTools,
    service: createVestigeService(baseUrl),
    views: { 'vestige.prices': assetPricesSchema, 'vestige.markets': rankedAssetsSchema },
  }
}
