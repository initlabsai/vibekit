/**
 * View id → wire-shape map for downstream component builders.
 *
 * Maps every dotted semantic view id declared by a tool in this package to
 * the zod schema of the data that tool emits (post-jsonSafe). Where several
 * tools declare the same view with the same shape they share one schema
 * object; where their shapes genuinely differ (a view rendered from more
 * than one kind of result) the entry is a union of the exact per-tool
 * schemas, so `ViewData<...>` is the honest type a component can receive.
 */
import { z } from 'zod'
import {
  accountAssetListSchema,
  accountListSchema,
  accountPortfolioSchema,
  appLocalStatesSchema,
  formattedAccountSchema,
} from './accounts/index.js'
import { assetHoldersSchema, assetInfoSchema, assetListSchema, assetSummarySchema } from './assets/index.js'
import {
  applicationBoxSchema,
  applicationListSchema,
  applicationLogsSchema,
  formattedApplicationSchema,
  globalStateSchema,
  localStateSchema,
} from './contracts/index.js'
import {
  blockDetailSchema,
  blockListSchema,
  networkConfigSchema,
  networkStatusSchema,
} from './network/index.js'
import { formattedTransactionSchema, transactionListSchema } from './shared/format.js'
import { transactionGroupSchema } from './transactions/index.js'

/** Data schema per dotted view id, keyed exactly as tools declare `view`. */
export const viewDataSchemas = {
  'account.summary': formattedAccountSchema,
  'account.list': accountListSchema,
  'account.portfolio': accountPortfolioSchema,
  'transaction.detail': formattedTransactionSchema,
  'transaction.list': transactionListSchema,
  'transaction.group': transactionGroupSchema,
  // Holdings rows (get_account_assets) and catalog rows (search_assets) share the view.
  'asset.list': z.union([accountAssetListSchema, assetListSchema]),
  // Indexer-sourced summary (lookup_asset) and algod-sourced params (get_asset_info).
  'asset.detail': z.union([assetSummarySchema, assetInfoSchema]),
  'asset.holders': assetHoldersSchema,
  'application.detail': formattedApplicationSchema,
  'application.list': applicationListSchema,
  // Per-account local states, decoded global state, and decoded local state.
  'application.state': z.union([appLocalStatesSchema, globalStateSchema, localStateSchema]),
  'application.logs': applicationLogsSchema,
  'application.box': applicationBoxSchema,
  'block.detail': blockDetailSchema,
  'block.list': blockListSchema,
  // Deployment configuration (get_network) and health metrics (get_network_status).
  'network.status': z.union([networkConfigSchema, networkStatusSchema]),
} as const

/** View id → TypeScript type of the data behind it. */
export type ViewDataMap = { [K in keyof typeof viewDataSchemas]: z.infer<(typeof viewDataSchemas)[K]> }

/** The data type a component rendering view V receives. */
export type ViewData<V extends keyof ViewDataMap> = ViewDataMap[V]
