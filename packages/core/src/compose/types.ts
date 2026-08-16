/**
 * Transaction specifications: the JSON shapes agents produce, turned into
 * real transactions by the compose engine. Ported from v1 minus appSpecPath
 * (v2 hosts pass specs inline; filesystem resolution is a host concern).
 */

export interface BaseTxnSpec {
  type: string
  /** Sender address. Required in v2 — there is no ambient "active account" (§10). */
  sender: string
  note?: string
}

export interface PaymentTxnSpec extends BaseTxnSpec {
  type: 'payment'
  receiver: string
  amount: number
  closeRemainderTo?: string
  /** Must be true when closeRemainderTo is set — closing empties the account. */
  confirmCloseAccount?: boolean
}

export interface AssetTransferTxnSpec extends BaseTxnSpec {
  type: 'asset_transfer'
  assetId: number
  receiver: string
  amount: number
  clawbackTarget?: string
  closeAssetTo?: string
  /** Must be true when closeAssetTo is set — closes the asset position. */
  confirmCloseAccount?: boolean
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
  /** Must be true to clear omitted role addresses (clearing is permanent). */
  confirmClearRoles?: boolean
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

/** Transaction-typed ABI method argument (pay/axfer/acfg/afrz). */
export interface TxnArg {
  type: 'pay' | 'axfer' | 'acfg' | 'afrz'
  sender?: string
  note?: string
  receiver?: string
  amount?: number
  assetId?: number
  total?: number
  decimals?: number
  assetName?: string
  unitName?: string
  url?: string
  defaultFrozen?: boolean
  manager?: string
  reserve?: string
  freeze?: string
  clawback?: string
  freezeTarget?: string
  frozen?: boolean
}

interface AppBaseSpec extends BaseTxnSpec {
  appId: number
  /** ARC-4 method signature, e.g. "hello(string)string". */
  methodSignature?: string
  /** Full ARC-56/ARC-32 app spec JSON (as string), used with `method`. */
  appSpec?: string
  /** Method name to look up in appSpec. */
  method?: string
  args?: unknown[]
  /** Extra fee in microALGO to cover inner transactions (fee pooling). */
  extraFee?: number
  maxFee?: number
}

export interface AppCallTxnSpec extends AppBaseSpec {
  type: 'app_call'
}
export interface AppOptInTxnSpec extends AppBaseSpec {
  type: 'app_opt_in'
}
export interface AppCloseOutTxnSpec extends AppBaseSpec {
  type: 'app_close_out'
}
export interface AppDeleteTxnSpec extends AppBaseSpec {
  type: 'app_delete'
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
