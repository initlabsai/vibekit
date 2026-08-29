import { z } from 'zod'

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

/** get_asset_price_history's wire shape (the `vestige.history` view). */
export const assetHistorySchema = z.object({
  assetId: z.number(),
  range: z.enum(['1d', '7d', '30d', '90d', '1y']),
  intervalSeconds: z.number(),
  candles: z.array(
    z.object({
      time: z.number().describe('Candle open, unix seconds'),
      open: z.number(),
      high: z.number(),
      low: z.number(),
      close: z.number(),
      volumeUsd: z.number(),
      confidence: z.number(),
    }),
  ),
})
export type AssetHistory = z.infer<typeof assetHistorySchema>

/** get_defi_overview's wire shape (the `vestige.protocols` view). */
export const defiProtocolsSchema = z.object({
  totalTvlUsd: z.number(),
  protocols: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      version: z.string(),
      url: z.string().nullable(),
      tvlUsd: z.number(),
      active: z.boolean(),
    }),
  ),
})
export type DefiProtocols = z.infer<typeof defiProtocolsSchema>
