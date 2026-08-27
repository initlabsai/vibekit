/**
 * View id → wire-shape map for downstream component builders.
 *
 * Maps every dotted semantic view id declared by a tool in this package to
 * the zod schema of the data that tool emits (post-jsonSafe). One view id
 * is one shape: tools sharing a view share the schema object.
 */
import { z } from 'zod'
import {
  accountAssetListSchema,
  accountListSchema,
  accountPortfolioSchema,
  appLocalStatesSchema,
  formattedAccountSchema,
} from './accounts/schemas.js'
import { assetDetailSchema, assetHoldersSchema, assetListSchema } from './assets/schemas.js'
import {
  applicationBoxSchema,
  applicationBoxesSchema,
  applicationListSchema,
  applicationLogsSchema,
  applicationProgramSchema,
  applicationStateSchema,
  formattedApplicationSchema,
} from './contracts/schemas.js'
import { blockDetailSchema, blockListSchema, networkStatusSchema } from './network/schemas.js'
import { formattedTransactionSchema, transactionListSchema } from './shared/schemas.js'
import { transactionGroupSchema } from './transactions/schemas.js'

/** Data schema per dotted view id, keyed exactly as tools declare `view`. */
export const viewDataSchemas = {
  'account.summary': formattedAccountSchema,
  'account.list': accountListSchema,
  'account.portfolio': accountPortfolioSchema,
  'transaction.detail': formattedTransactionSchema,
  'transaction.list': transactionListSchema,
  'transaction.group': transactionGroupSchema,
  'asset.detail': assetDetailSchema,
  'asset.list': assetListSchema,
  'asset.holdings': accountAssetListSchema,
  'asset.holders': assetHoldersSchema,
  'application.detail': formattedApplicationSchema,
  'application.list': applicationListSchema,
  'application.state': applicationStateSchema,
  'application.locals': appLocalStatesSchema,
  'application.logs': applicationLogsSchema,
  'application.box': applicationBoxSchema,
  'application.boxes': applicationBoxesSchema,
  'application.program': applicationProgramSchema,
  'block.detail': blockDetailSchema,
  'block.list': blockListSchema,
  'network.status': networkStatusSchema,
} as const

/** View id → TypeScript type of the data behind it. */
export type ViewDataMap = {
  [K in keyof typeof viewDataSchemas]: z.infer<(typeof viewDataSchemas)[K]>
}

/** The data type a component rendering view V receives. */
export type ViewData<V extends keyof ViewDataMap> = ViewDataMap[V]
