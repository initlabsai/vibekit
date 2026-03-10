// Re-export from domain packages for backward compatibility
export { sanitizeBigInts, formatAssetAmount } from '@vibekit/core'
export type { ToolDefinition } from '@vibekit/core'

export type { FormattedAccount, AccountAsset, AccountAppLocalState } from '@vibekit/accounts'
export type { FormattedAsset, AssetBalance } from '@vibekit/assets'
export type { FormattedApplication } from '@vibekit/contracts'
export type { FormattedTransaction } from '@vibekit/transactions'

// Re-export types that are only in indexer
export type { FormattedBlock, NetworkStatus, LogEntry } from './types'
export { DEFAULT_LIMIT, stripFinalToken } from './types'

// Re-export decode-state from core for backward compatibility
export { decodeStateValue, type DecodedValue } from '@vibekit/core'

// Keep indexer-specific exports
export { createIndexerClient } from './client'
export { INDEXER_PRESETS, ALGOD_PRESETS, type IndexerPreset } from './networks'

// Formatters that remain in indexer (they depend on algosdk types)
export {
  microalgosToAlgos,
  formatTransaction,
  formatAccount,
  formatAsset,
  formatBlock,
  formatApplication,
} from './formatters'

// Re-export handlers for direct usage (backward compat)
export * from './handlers/index'

// Build indexerTools by aggregating domain package tools
import { networkTools } from '@vibekit/network'
import { accountTools } from '@vibekit/accounts'
import { assetTools } from '@vibekit/assets'
import { contractTools } from '@vibekit/contracts'
import { transactionTools } from '@vibekit/transactions'
import type { ToolDefinition } from '@vibekit/core'

/** @deprecated Use domain package tools directly instead. */
export type IndexerToolDefinition = ToolDefinition

/** @deprecated Import tools from domain packages directly. */
export const indexerTools: ToolDefinition[] = [
  ...networkTools,
  ...accountTools.filter((t) => t.name !== 'get_account_portfolio'),
  ...assetTools,
  ...contractTools,
  ...transactionTools,
]
