import { bytesToBase64 } from '@initlabs/vibekit-core'
import type { FormattedAssetConfig, FormattedTransaction } from './schemas.js'

export { formattedAssetConfigSchema, formattedTransactionSchema, transactionListSchema } from './schemas.js'
export type { FormattedAssetConfig, FormattedTransaction } from './schemas.js'

type IndexerTransaction = InstanceType<typeof import('algosdk').indexerModels.Transaction>

/** uint64 → number, or decimal string above 2^53 (Number() would silently round). */
export function uint64(value: bigint | number): number | string {
  if (typeof value === 'number') return value
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString()
}

export function formatTransaction(tx: IndexerTransaction): FormattedTransaction {
  const formatted: FormattedTransaction = {
    // Inner transactions carry no indexer-assigned id, and txType is optional
    // in the model — leave the keys absent rather than asserting.
    id: tx.id,
    type: tx.txType,
    sender: String(tx.sender),
    feeMicroAlgos: uint64(tx.fee),
    confirmedRound: tx.confirmedRound != null ? Number(tx.confirmedRound) : undefined,
    roundTime: tx.roundTime != null ? Number(tx.roundTime) : undefined,
  }
  if (tx.rekeyTo) formatted.rekeyTo = String(tx.rekeyTo)
  if (tx.paymentTransaction) {
    formatted.paymentAmountMicroAlgos = uint64(tx.paymentTransaction.amount)
    formatted.receiver = String(tx.paymentTransaction.receiver)
    if (tx.paymentTransaction.closeRemainderTo) {
      formatted.closeTo = String(tx.paymentTransaction.closeRemainderTo)
    }
    if (tx.paymentTransaction.closeAmount != null) {
      formatted.closeAmountMicroAlgos = uint64(tx.paymentTransaction.closeAmount)
    }
  }
  if (tx.assetTransferTransaction) {
    formatted.assetId = Number(tx.assetTransferTransaction.assetId)
    formatted.assetAmount = uint64(tx.assetTransferTransaction.amount)
    formatted.receiver = String(tx.assetTransferTransaction.receiver)
    if (tx.assetTransferTransaction.sender) {
      formatted.clawbackFrom = String(tx.assetTransferTransaction.sender)
    }
    if (tx.assetTransferTransaction.closeTo) {
      formatted.closeTo = String(tx.assetTransferTransaction.closeTo)
    }
    if (tx.assetTransferTransaction.closeAmount != null) {
      formatted.closeAssetAmount = uint64(tx.assetTransferTransaction.closeAmount)
    }
  }
  if (tx.applicationTransaction) {
    formatted.applicationId = Number(tx.applicationTransaction.applicationId)
    if (tx.applicationTransaction.onCompletion) {
      formatted.onCompletion = tx.applicationTransaction.onCompletion
    }
    const appArgs = tx.applicationTransaction.applicationArgs
    if (appArgs && appArgs.length > 0) {
      formatted.applicationArgs = appArgs.map((arg) => bytesToBase64(arg))
    }
  }
  if (tx.assetConfigTransaction) {
    // Zero means this acfg creates the asset (createdAssetId carries the result).
    formatted.assetId = Number(tx.assetConfigTransaction.assetId ?? 0)
    const params = tx.assetConfigTransaction.params
    if (params) {
      const config: FormattedAssetConfig = { total: uint64(params.total), decimals: Number(params.decimals) }
      if (params.unitName) config.unitName = params.unitName
      if (params.name) config.assetName = params.name
      if (params.url) config.url = params.url
      if (params.manager) config.manager = String(params.manager)
      if (params.reserve) config.reserve = String(params.reserve)
      if (params.freeze) config.freeze = String(params.freeze)
      if (params.clawback) config.clawback = String(params.clawback)
      if (params.defaultFrozen != null) config.defaultFrozen = params.defaultFrozen
      formatted.assetConfig = config
    }
  }
  if (tx.assetFreezeTransaction) {
    formatted.assetId = Number(tx.assetFreezeTransaction.assetId)
    formatted.freezeTarget = String(tx.assetFreezeTransaction.address)
    formatted.frozen = tx.assetFreezeTransaction.newFreezeStatus
  }
  if (tx.createdAssetIndex != null) formatted.createdAssetId = Number(tx.createdAssetIndex)
  if (tx.createdApplicationIndex != null) {
    formatted.createdApplicationId = Number(tx.createdApplicationIndex)
  }
  if (tx.authAddr) formatted.signer = String(tx.authAddr)
  if (tx.note && tx.note.length > 0) {
    // Notes are untrusted chain data: surface printable text, anything else as base64.
    const decoded = new TextDecoder().decode(tx.note)
    formatted.note = /^[^\p{C}]*$/u.test(decoded) ? decoded : bytesToBase64(tx.note)
  }
  if (tx.group) formatted.group = bytesToBase64(tx.group)
  if (tx.innerTxns && tx.innerTxns.length > 0)
    formatted.innerTxns = tx.innerTxns.map(formatTransaction)
  if (tx.globalStateDelta) formatted.globalStateDelta = tx.globalStateDelta
  if (tx.localStateDelta) formatted.localStateDelta = tx.localStateDelta
  if (tx.logs && tx.logs.length > 0) formatted.logs = tx.logs.map((l) => bytesToBase64(l))
  return formatted
}
