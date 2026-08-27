/**
 * Formats an algosdk Transaction into the shared FormattedTransaction wire.
 * Used for unsigned compose groups and for confirmed payset entries in a live
 * block tail — one mapping so cards stay honest across both paths.
 */
import algosdk from 'algosdk'
import { bytesToBase64 } from '@initlabs/vibekit-core'
import type { FormattedTransaction } from '@initlabs/vibekit-tools'

const ON_COMPLETE_NAMES = ['noop', 'optin', 'closeout', 'clear', 'update', 'delete'] as const

export function safeUint64(value: bigint | number): number | string {
  const asBig = typeof value === 'bigint' ? value : BigInt(value)
  return asBig <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(asBig) : asBig.toString()
}

export function printableNote(note: Uint8Array | undefined): string | undefined {
  if (!note || note.length === 0) return undefined
  const decoded = new TextDecoder().decode(note)
  return /^[^\p{C}]*$/u.test(decoded) ? decoded : undefined
}

/**
 * Transaction id for one payset entry. Block encoding strips `gen`/`gh` from
 * every transaction and records whether they were there as the entry's
 * hasGenesisID/hasGenesisHash flags, so hashing a payset transaction as it
 * arrives yields an id that matches nothing on chain. Put them back first.
 */
export function txIdInBlock(
  txn: algosdk.Transaction,
  flags: { hasGenesisID?: boolean; hasGenesisHash?: boolean },
  header: { genesisID?: string; genesisHash?: Uint8Array },
): string | undefined {
  try {
    const restoreId = flags.hasGenesisID === true && txn.genesisID === undefined && header.genesisID
    const restoreHash =
      flags.hasGenesisHash === true && txn.genesisHash === undefined && header.genesisHash
    if (!restoreId && !restoreHash) return txn.txID()
    const data = txn.toEncodingData()
    if (restoreId) data.set('gen', header.genesisID)
    if (restoreHash) data.set('gh', header.genesisHash)
    return algosdk.Transaction.fromEncodingData(data).txID()
  } catch {
    return undefined
  }
}

export interface AlgodTxnExtras {
  id?: string
  confirmedRound?: number
  roundTime?: number
  createdAssetId?: number
  createdApplicationId?: number
  closeAmountMicroAlgos?: number | string
  closeAssetAmount?: number | string
}

/** Maps one algosdk Transaction onto the tools wire shape. */
export function formatAlgodTransaction(
  txn: algosdk.Transaction,
  extras: AlgodTxnExtras = {},
): FormattedTransaction {
  const formatted: FormattedTransaction = {
    sender: txn.sender.toString(),
    feeMicroAlgos: safeUint64(txn.fee),
    type: String(txn.type),
  }
  if (extras.id) formatted.id = extras.id
  if (extras.confirmedRound !== undefined) formatted.confirmedRound = extras.confirmedRound
  if (extras.roundTime !== undefined) formatted.roundTime = extras.roundTime
  const note = printableNote(txn.note)
  if (note) formatted.note = note
  if (txn.rekeyTo) formatted.rekeyTo = txn.rekeyTo.toString()
  if (txn.group && txn.group.length > 0) formatted.group = bytesToBase64(txn.group)
  if (txn.payment) {
    formatted.receiver = txn.payment.receiver.toString()
    formatted.paymentAmountMicroAlgos = safeUint64(txn.payment.amount)
    if (txn.payment.closeRemainderTo) formatted.closeTo = txn.payment.closeRemainderTo.toString()
  }
  if (txn.assetTransfer) {
    formatted.assetId = Number(txn.assetTransfer.assetIndex)
    formatted.assetAmount = safeUint64(txn.assetTransfer.amount)
    formatted.receiver = txn.assetTransfer.receiver.toString()
    if (txn.assetTransfer.assetSender) formatted.clawbackFrom = txn.assetTransfer.assetSender.toString()
    if (txn.assetTransfer.closeRemainderTo) formatted.closeTo = txn.assetTransfer.closeRemainderTo.toString()
  }
  if (txn.applicationCall) {
    formatted.applicationId = Number(txn.applicationCall.appIndex)
    formatted.onCompletion = ON_COMPLETE_NAMES[txn.applicationCall.onComplete] ?? 'noop'
    if (txn.applicationCall.appArgs && txn.applicationCall.appArgs.length > 0) {
      formatted.applicationArgs = txn.applicationCall.appArgs.map((arg) => bytesToBase64(arg))
    }
  }
  if (txn.assetConfig) {
    formatted.assetId = Number(txn.assetConfig.assetIndex)
    const config: NonNullable<FormattedTransaction['assetConfig']> = {
      total: safeUint64(txn.assetConfig.total),
      decimals: Number(txn.assetConfig.decimals),
    }
    if (txn.assetConfig.unitName) config.unitName = txn.assetConfig.unitName
    if (txn.assetConfig.assetName) config.assetName = txn.assetConfig.assetName
    if (txn.assetConfig.assetURL) config.url = txn.assetConfig.assetURL
    if (txn.assetConfig.manager) config.manager = txn.assetConfig.manager.toString()
    if (txn.assetConfig.reserve) config.reserve = txn.assetConfig.reserve.toString()
    if (txn.assetConfig.freeze) config.freeze = txn.assetConfig.freeze.toString()
    if (txn.assetConfig.clawback) config.clawback = txn.assetConfig.clawback.toString()
    if (txn.assetConfig.defaultFrozen != null) config.defaultFrozen = txn.assetConfig.defaultFrozen
    formatted.assetConfig = config
  }
  if (txn.assetFreeze) {
    formatted.assetId = Number(txn.assetFreeze.assetIndex)
    formatted.freezeTarget = txn.assetFreeze.freezeAccount.toString()
    formatted.frozen = txn.assetFreeze.frozen
  }
  if (extras.createdAssetId !== undefined && extras.createdAssetId > 0) {
    formatted.createdAssetId = extras.createdAssetId
  }
  if (extras.createdApplicationId !== undefined && extras.createdApplicationId > 0) {
    formatted.createdApplicationId = extras.createdApplicationId
  }
  if (extras.closeAmountMicroAlgos !== undefined) formatted.closeAmountMicroAlgos = extras.closeAmountMicroAlgos
  if (extras.closeAssetAmount !== undefined) formatted.closeAssetAmount = extras.closeAssetAmount
  return formatted
}

export function typeCounts(
  transactions: readonly { type?: string }[],
): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>()
  const order: string[] = []
  for (const txn of transactions) {
    const type = txn.type && txn.type.length > 0 ? txn.type : 'other'
    if (!counts.has(type)) order.push(type)
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return order.map((type) => ({ type, count: counts.get(type)! }))
}
