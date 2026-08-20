import { viewDataSchemas } from '@initlabs/vibekit-tools/views'

import { structuredResultSchema, type StructuredResult } from './results.js'
import { transactionDetailDataSchema } from './transactions.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'
import type { ResultIdentity } from './live-payment.js'

/** Wraps a lookup_transaction result as a transaction detail record. */
export function buildTransactionDetailRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_transaction',
): StructuredResult {
  const txn = viewDataSchemas['transaction.detail'].parse(wire)
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data: transactionDetailDataSchema.parse({
      id: txn.id,
      type: txn.type ?? 'txn',
      status: txn.confirmedRound === undefined ? 'pending' : 'confirmed',
      sender: txn.sender,
      feeMicroAlgos: txn.feeMicroAlgos,
      ...(txn.receiver === undefined ? {} : { receiver: txn.receiver }),
      ...(txn.paymentAmountMicroAlgos === undefined
        ? {}
        : { paymentAmountMicroAlgos: txn.paymentAmountMicroAlgos }),
      ...(txn.confirmedRound === undefined ? {} : { confirmedRound: txn.confirmedRound }),
      ...(txn.roundTime === undefined ? {} : { roundTime: txn.roundTime }),
      ...(txn.assetId === undefined ? {} : { assetId: txn.assetId }),
      ...(txn.assetAmount === undefined ? {} : { assetAmount: txn.assetAmount }),
      ...(txn.assetName === undefined ? {} : { assetName: txn.assetName }),
      ...(txn.assetUnitName === undefined ? {} : { assetUnitName: txn.assetUnitName }),
      ...(txn.assetDecimals === undefined ? {} : { assetDecimals: txn.assetDecimals }),
      ...(txn.applicationId === undefined ? {} : { applicationId: txn.applicationId }),
      ...(txn.onCompletion === undefined ? {} : { onCompletion: txn.onCompletion }),
      ...(txn.note === undefined ? {} : { note: txn.note }),
      ...(txn.group === undefined ? {} : { group: txn.group }),
      ...(txn.innerTxns && txn.innerTxns.length > 0 ? { innerCount: txn.innerTxns.length } : {}),
      ...(txn.rekeyTo === undefined ? {} : { rekeyTo: txn.rekeyTo }),
      ...(txn.closeTo === undefined ? {} : { closeTo: txn.closeTo }),
      ...(txn.closeAmountMicroAlgos === undefined
        ? {}
        : { closeAmountMicroAlgos: txn.closeAmountMicroAlgos }),
      ...(txn.closeAssetAmount === undefined ? {} : { closeAssetAmount: txn.closeAssetAmount }),
      ...(txn.clawbackFrom === undefined ? {} : { clawbackFrom: txn.clawbackFrom }),
    }),
  })
}

/** The capability of looking a transaction up as an authoritative record. */
export interface TransactionLookupHost {
  lookupTransaction(txid: string): Promise<StructuredResult>
  /** Looks every transaction in an atomic group up as one transaction.group record. */
  lookupTransactionGroup(groupId: string): Promise<StructuredResult>
}
