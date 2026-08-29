/**
 * The built-in plugins' view ids and wire schemas, zod only — safe for a
 * browser host that renders plugin cards without loading the plugins' SDKs.
 * Each id is the `view` its tool declares and the key in that plugin's `views`.
 */
import type { z } from 'zod'

import { nfdRecordSchema } from './nfd/schemas.js'
import { assetProfileSchema } from './pera/schemas.js'
import { assetPricesSchema, rankedAssetsSchema } from './vestige/schemas.js'

export type { NfdRecord } from './nfd/schemas.js'
export type { AssetProfile } from './pera/schemas.js'
export type { AssetPrices, RankedAssets } from './vestige/schemas.js'

export const PLUGIN_VIEW_IDS = [
  'nfd.profile',
  'vestige.prices',
  'vestige.markets',
  'pera.asset',
] as const

export type PluginViewId = (typeof PLUGIN_VIEW_IDS)[number]

export const pluginViewSchemas = {
  'nfd.profile': nfdRecordSchema,
  'vestige.prices': assetPricesSchema,
  'vestige.markets': rankedAssetsSchema,
  'pera.asset': assetProfileSchema,
} as const satisfies Record<PluginViewId, z.ZodType>
