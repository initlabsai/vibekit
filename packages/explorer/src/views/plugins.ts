/**
 * Plugin views: the built-in plugins' wire schemas, bridged and derived
 * exactly like the core views. A plugin declares its view id and schema;
 * the host owns nothing but the card.
 */
import {
  PLUGIN_VIEW_IDS,
  pluginViewSchemas,
  type PluginViewId,
} from '@initlabs/vibekit/plugins/views'

export { PLUGIN_VIEW_IDS, type PluginViewId }

/** True for a view a plugin declares (rendered from its own schema, re-runnable through the plugin host). */
export function isPluginViewId(view: string): view is PluginViewId {
  return (PLUGIN_VIEW_IDS as readonly string[]).includes(view)
}
import type { ResultIdentity, StructuredResult } from '../core/results.js'
import { record, viewModelFor } from './derive.js'

export type {
  WebPage,
  WebResults,
  MarketRow,
  Markets,
  OpenOrders,
  OrderbookView,
  Positions,
  SwapQuote,
  AssetHistory,
  AssetPrices,
  AssetProfile,
  DefiProtocols,
  NfdList,
  NfdRecord,
  RankedAssets,
} from '@initlabs/vibekit/plugins/views'

/** A record builder for one plugin view: parse the wire, wrap it. */
export function pluginRecordBuilder(view: PluginViewId) {
  return (identity: ResultIdentity, wire: unknown, toolName: string): StructuredResult =>
    record(identity, toolName, pluginViewSchemas[view].parse(wire))
}

/** Builds a plugin view's record from data a host fetched itself (a resolved name). */
export function buildPluginRecord(
  view: PluginViewId,
  identity: ResultIdentity,
  wire: unknown,
  toolName: string,
): StructuredResult {
  return pluginRecordBuilder(view)(identity, wire, toolName)
}

export const createNfdProfileViewModel = viewModelFor(
  pluginViewSchemas['nfd.profile'],
  'nfd.profile',
  'NFD profile',
)
export const createVestigePricesViewModel = viewModelFor(
  pluginViewSchemas['vestige.prices'],
  'vestige.prices',
  'Asset prices',
)
export const createVestigeMarketsViewModel = viewModelFor(
  pluginViewSchemas['vestige.markets'],
  'vestige.markets',
  'Ranked assets',
)
export const createVestigeHistoryViewModel = viewModelFor(
  pluginViewSchemas['vestige.history'],
  'vestige.history',
  'Price history',
)
export const createDefiProtocolsViewModel = viewModelFor(
  pluginViewSchemas['vestige.protocols'],
  'vestige.protocols',
  'DeFi protocols',
)
export const createSwapQuoteViewModel = viewModelFor(
  pluginViewSchemas['haystack.quote'],
  'haystack.quote',
  'Swap quote',
)
export const createArcadeMarketsViewModel = viewModelFor(
  pluginViewSchemas['arcade.markets'],
  'arcade.markets',
  'Markets',
)
export const createArcadeMarketViewModel = viewModelFor(
  pluginViewSchemas['arcade.market'],
  'arcade.market',
  'Market',
)
export const createArcadeOrderbookViewModel = viewModelFor(
  pluginViewSchemas['arcade.orderbook'],
  'arcade.orderbook',
  'Orderbook',
)
export const createArcadePositionsViewModel = viewModelFor(
  pluginViewSchemas['arcade.positions'],
  'arcade.positions',
  'Positions',
)
export const createArcadeOrdersViewModel = viewModelFor(
  pluginViewSchemas['arcade.orders'],
  'arcade.orders',
  'Open orders',
)
export const createWebResultsViewModel = viewModelFor(
  pluginViewSchemas['web.results'],
  'web.results',
  'Web results',
)
export const createWebPageViewModel = viewModelFor(
  pluginViewSchemas['web.page'],
  'web.page',
  'Web page',
)
export const createNfdListViewModel = viewModelFor(
  pluginViewSchemas['nfd.list'],
  'nfd.list',
  'NFD names',
)
export const createPeraAssetViewModel = viewModelFor(
  pluginViewSchemas['pera.asset'],
  'pera.asset',
  'Asset profile',
)
