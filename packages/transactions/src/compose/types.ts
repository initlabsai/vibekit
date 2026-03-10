/**
 * Shared type definitions for transaction composition
 */

// Transaction specification types
export interface BaseTxnSpec {
  type: string
  sender?: string
  note?: string
}

export interface PaymentTxnSpec extends BaseTxnSpec {
  type: 'payment'
  receiver: string
  amount: number
  closeRemainderTo?: string
}

export interface AssetTransferTxnSpec extends BaseTxnSpec {
  type: 'asset_transfer'
  assetId: number
  receiver: string
  amount: number
  clawbackTarget?: string
  closeAssetTo?: string
}

export interface AssetOptInTxnSpec extends BaseTxnSpec {
  type: 'asset_opt_in'
  assetId: number
}

export interface AssetOptOutTxnSpec extends BaseTxnSpec {
  type: 'asset_opt_out'
  assetId: number
  closeAssetTo: string
  ensureZeroBalance?: boolean
}

export interface AssetCreateTxnSpec extends BaseTxnSpec {
  type: 'asset_create'
  total: number
  decimals?: number
  assetName?: string
  unitName?: string
  url?: string
  metadataHash?: string
  defaultFrozen?: boolean
  manager?: string
  reserve?: string
  freeze?: string
  clawback?: string
}

export interface AssetConfigTxnSpec extends BaseTxnSpec {
  type: 'asset_config'
  assetId: number
  manager?: string
  reserve?: string
  freeze?: string
  clawback?: string
}

export interface AssetFreezeTxnSpec extends BaseTxnSpec {
  type: 'asset_freeze'
  assetId: number
  freezeTarget: string
  frozen: boolean
}

export interface AssetDestroyTxnSpec extends BaseTxnSpec {
  type: 'asset_destroy'
  assetId: number
}

export interface AppCallTxnSpec extends BaseTxnSpec {
  type: 'app_call'
  appId: number
  methodSignature?: string
  appSpec?: string
  appSpecPath?: string
  method?: string
  args?: unknown[]
  extraFee?: number
  maxFee?: number
}

export interface AppOptInTxnSpec extends BaseTxnSpec {
  type: 'app_opt_in'
  appId: number
  methodSignature?: string
  appSpec?: string
  appSpecPath?: string
  method?: string
  args?: unknown[]
  extraFee?: number
  maxFee?: number
}

export interface AppCloseOutTxnSpec extends BaseTxnSpec {
  type: 'app_close_out'
  appId: number
  methodSignature?: string
  appSpec?: string
  appSpecPath?: string
  method?: string
  args?: unknown[]
  extraFee?: number
  maxFee?: number
}

export interface AppDeleteTxnSpec extends BaseTxnSpec {
  type: 'app_delete'
  appId: number
  methodSignature?: string
  appSpec?: string
  appSpecPath?: string
  method?: string
  args?: unknown[]
  extraFee?: number
  maxFee?: number
}

export type TxnSpec =
  | PaymentTxnSpec
  | AssetTransferTxnSpec
  | AssetOptInTxnSpec
  | AssetOptOutTxnSpec
  | AssetCreateTxnSpec
  | AssetConfigTxnSpec
  | AssetFreezeTxnSpec
  | AssetDestroyTxnSpec
  | AppCallTxnSpec
  | AppOptInTxnSpec
  | AppCloseOutTxnSpec
  | AppDeleteTxnSpec

// Transaction argument types (for ABI method call args)
export interface PayTxnArg {
  type: 'pay'
  receiver: string
  amount: number
  sender?: string
  note?: string
}

export interface AxferTxnArg {
  type: 'axfer'
  assetId: number
  receiver: string
  amount: number
  sender?: string
  note?: string
}

export interface AcfgTxnArg {
  type: 'acfg'
  assetId?: number
  manager?: string
  reserve?: string
  freeze?: string
  clawback?: string
  total?: number
  decimals?: number
  assetName?: string
  unitName?: string
  url?: string
  defaultFrozen?: boolean
  sender?: string
  note?: string
}

export interface AfrzTxnArg {
  type: 'afrz'
  assetId: number
  freezeTarget: string
  frozen: boolean
  sender?: string
  note?: string
}

export type TxnArg = PayTxnArg | AxferTxnArg | AcfgTxnArg | AfrzTxnArg

/**
 * Resolves an app spec from either an inline string or an environment-specific reference (e.g. file path).
 * - MCP: reads appSpecPath from the local filesystem
 * - Browser: could resolve from uploaded files, URLs, etc.
 * Returns the app spec JSON string, or undefined if neither source is available.
 */
export type ResolveAppSpecFn = (
  appSpec?: string,
  appSpecPath?: string
) => Promise<string | undefined>
