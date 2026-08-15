import { bytesToBase64 } from '@initlabs/core'

const MICROALGOS_PER_ALGO = 1_000_000

type IndexerTransaction = InstanceType<typeof import('algosdk').indexerModels.Transaction>

/** Formatted transaction returned by handlers. */
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
  assetName?: string
  assetUnitName?: string
  assetDecimals?: number
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
