/**
 * The built-in plugins' view ids and wire schemas, zod only — safe for a
 * browser host that renders plugin cards without loading the plugins' SDKs.
 * Each id is the `view` its tool declares and the key in that plugin's `views`.
 */
import type { z } from 'zod'

import {
  marketSchema,
  marketsSchema,
  openOrdersSchema,
  orderbookSchema,
  positionsSchema,
} from './alpha-arcade/schemas.js'
import { swapQuoteSchema } from './haystack/schemas.js'
import { nfdRecordSchema } from './nfd/schemas.js'
import { assetProfileSchema } from './pera/schemas.js'
import {
  assetHistorySchema,
  assetPricesSchema,
  defiProtocolsSchema,
  rankedAssetsSchema,
} from './vestige/schemas.js'
import { webPageSchema, webResultsSchema } from './web/schemas.js'

export type { WebPage, WebResults } from './web/schemas.js'
export type {
  MarketRow,
  Markets,
  OpenOrders,
  OrderbookView,
  Positions,
} from './alpha-arcade/schemas.js'
export type { SwapQuote } from './haystack/schemas.js'
export type { NfdRecord } from './nfd/schemas.js'
export type { AssetProfile } from './pera/schemas.js'
export type { AssetHistory, AssetPrices, DefiProtocols, RankedAssets } from './vestige/schemas.js'

export const PLUGIN_VIEW_IDS = [
  'nfd.profile',
  'vestige.prices',
  'vestige.markets',
  'vestige.history',
  'vestige.protocols',
  'pera.asset',
  'haystack.quote',
  'arcade.markets',
  'arcade.market',
  'arcade.orderbook',
  'arcade.positions',
  'arcade.orders',
  'web.results',
  'web.page',
] as const

export type PluginViewId = (typeof PLUGIN_VIEW_IDS)[number]

export const pluginViewSchemas = {
  'nfd.profile': nfdRecordSchema,
  'vestige.prices': assetPricesSchema,
  'vestige.markets': rankedAssetsSchema,
  'vestige.history': assetHistorySchema,
  'vestige.protocols': defiProtocolsSchema,
  'pera.asset': assetProfileSchema,
  'haystack.quote': swapQuoteSchema,
  'arcade.markets': marketsSchema,
  'arcade.market': marketSchema,
  'arcade.orderbook': orderbookSchema,
  'arcade.positions': positionsSchema,
  'arcade.orders': openOrdersSchema,
  'web.results': webResultsSchema,
  'web.page': webPageSchema,
} as const satisfies Record<PluginViewId, z.ZodType>
