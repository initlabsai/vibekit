import { z } from 'zod'

const routeLegSchema = z.object({
  venue: z.string().describe('Protocol and fee tier, e.g. "Tinyman V2"'),
  percentage: z.number().describe('Share of the input routed here, 0..100'),
})

/** get_swap_quote's wire shape (the `haystack.quote` view). Amounts are base units as strings. */
export const swapQuoteSchema = z.object({
  fromAssetId: z.number(),
  toAssetId: z.number(),
  fromDecimals: z.number(),
  toDecimals: z.number(),
  fromUnit: z.string(),
  toUnit: z.string(),
  type: z.enum(['fixed-input', 'fixed-output']),
  amountIn: z.string(),
  amountOut: z.string(),
  priceImpactPercent: z.number().optional(),
  usdIn: z.number().optional(),
  usdOut: z.number().optional(),
  route: z.array(routeLegSchema),
  /** True when the sender still has to opt into the output asset; the swap folds the opt-in in. */
  needsOptIn: z.boolean(),
})
export type SwapQuote = z.infer<typeof swapQuoteSchema>
