import { z } from 'zod'

const marketRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string().optional(),
  image: z.string().optional(),
  marketAppId: z.number(),
  yesAssetId: z.number(),
  noAssetId: z.number(),
  yesPriceUsd: z
    .number()
    .optional()
    .describe('A share pays $1, so the price is the implied probability'),
  noPriceUsd: z.number().optional(),
  volumeUsd: z.number().optional(),
  endTs: z.number().describe('Unix seconds'),
  isResolved: z.boolean().optional(),
  isLive: z.boolean().optional(),
  resolution: z.number().optional(),
  categories: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  options: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        marketAppId: z.number(),
        yesPriceUsd: z.number().optional(),
        noPriceUsd: z.number().optional(),
      }),
    )
    .optional(),
})

/** get_live_markets' wire shape (the `arcade.markets` view). */
export const marketsSchema = z.object({
  markets: z.array(marketRowSchema),
  total: z.number(),
  nextToken: z.string().optional().describe('Pass back to get_live_markets for the next page'),
})
export type Markets = z.infer<typeof marketsSchema>

/** get_market's wire shape (the `arcade.market` view). */
export const marketSchema = marketRowSchema
export type MarketRow = z.infer<typeof marketSchema>

const orderLevelSchema = z.object({
  priceUsd: z.number(),
  quantity: z.number().describe('Shares'),
  escrowAppId: z.number(),
  owner: z.string(),
})
const sideSchema = z.object({ bids: z.array(orderLevelSchema), asks: z.array(orderLevelSchema) })

/** get_orderbook's wire shape (the `arcade.orderbook` view). */
export const orderbookSchema = z.object({
  marketAppId: z.number(),
  yes: sideSchema,
  no: sideSchema,
})
export type OrderbookView = z.infer<typeof orderbookSchema>

/** get_positions' wire shape (the `arcade.positions` view). */
export const positionsSchema = z.object({
  walletAddress: z.string(),
  positions: z.array(
    z.object({
      marketAppId: z.number(),
      title: z.string(),
      yesAssetId: z.number(),
      noAssetId: z.number(),
      yesBalance: z.number().describe('Shares'),
      noBalance: z.number().describe('Shares'),
    }),
  ),
})
export type Positions = z.infer<typeof positionsSchema>

/** get_open_orders' wire shape (the `arcade.orders` view). */
export const openOrdersSchema = z.object({
  marketAppId: z.number(),
  walletAddress: z.string(),
  orders: z.array(
    z.object({
      escrowAppId: z.number(),
      marketAppId: z.number(),
      position: z.enum(['YES', 'NO']),
      side: z.enum(['BUY', 'SELL']),
      priceUsd: z.number(),
      quantity: z.number(),
      quantityFilled: z.number(),
      slippageUsd: z.number(),
      owner: z.string(),
    }),
  ),
})
export type OpenOrders = z.infer<typeof openOrdersSchema>
