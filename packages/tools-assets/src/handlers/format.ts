import { bytesToBase64 } from '@initlabs/vibekit-core'

type IndexerAsset = InstanceType<typeof import('algosdk').indexerModels.Asset>
type IndexerTransaction = InstanceType<typeof import('algosdk').indexerModels.Transaction>

const MICROALGOS_PER_ALGO = 1_000_000

/** Formatted asset returned by handlers. */
export interface FormattedAsset {
  assetId: number
  name?: string
  unitName?: string
  totalSupply: string
  decimals: number
  creator?: string
  manager?: string
  reserve?: string
  freeze?: string
  clawback?: string
  defaultFrozen?: boolean
  url?: string
}

/** Asset balance entry. */
export interface AssetBalance {
  address: string
  amount: string
  isFrozen: boolean
}

export function formatAsset(asset: IndexerAsset): FormattedAsset {
  const params = asset.params
  return {
    assetId: Number(asset.index),
    name: params.name,
    unitName: params.unitName,
    totalSupply: String(params.total),
    decimals: params.decimals,
    creator: params.creator ? String(params.creator) : undefined,
    manager: params.manager ? String(params.manager) : undefined,
    reserve: params.reserve ? String(params.reserve) : undefined,
    freeze: params.freeze ? String(params.freeze) : undefined,
    clawback: params.clawback ? String(params.clawback) : undefined,
    defaultFrozen: params.defaultFrozen,
    url: params.url,
  }
}

export interface FormattedTransaction {
  id: string
  type: string
  sender: string
  fee: number
  confirmedRound?: number
  roundTime?: number
  paymentAmount?: number
  receiver?: string
  assetId?: number
  assetAmount?: number | string
  applicationId?: number
  note?: string
  group?: string
  innerTxns?: FormattedTransaction[]
  globalStateDelta?: unknown
  localStateDelta?: unknown
  logs?: string[]
}

export function formatTransaction(tx: IndexerTransaction): FormattedTransaction {
  const formatted: FormattedTransaction = {
    id: tx.id!,
    type: tx.txType as string,
    sender: String(tx.sender),
    fee: Number(tx.fee) / MICROALGOS_PER_ALGO,
    confirmedRound: tx.confirmedRound != null ? Number(tx.confirmedRound) : undefined,
    roundTime: tx.roundTime != null ? Number(tx.roundTime) : undefined,
  }
  if (tx.paymentTransaction) {
    formatted.paymentAmount = Number(tx.paymentTransaction.amount) / MICROALGOS_PER_ALGO
    formatted.receiver = String(tx.paymentTransaction.receiver)
  }
  if (tx.assetTransferTransaction) {
    formatted.assetId = Number(tx.assetTransferTransaction.assetId)
    formatted.assetAmount = Number(tx.assetTransferTransaction.amount)
    formatted.receiver = String(tx.assetTransferTransaction.receiver)
  }
  if (tx.applicationTransaction)
    formatted.applicationId = Number(tx.applicationTransaction.applicationId)
  if (tx.note && tx.note.length > 0) {
    try {
      formatted.note = new TextDecoder().decode(tx.note)
    } catch {
      formatted.note = bytesToBase64(tx.note)
    }
  }
  if (tx.group) formatted.group = bytesToBase64(tx.group)
  if (tx.innerTxns && tx.innerTxns.length > 0)
    formatted.innerTxns = tx.innerTxns.map(formatTransaction)
  if (tx.globalStateDelta) formatted.globalStateDelta = tx.globalStateDelta
  if (tx.localStateDelta) formatted.localStateDelta = tx.localStateDelta
  if (tx.logs && tx.logs.length > 0) formatted.logs = tx.logs.map((l) => bytesToBase64(l))
  return formatted
}
