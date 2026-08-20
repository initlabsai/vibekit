import { z } from 'zod'

import { uint64JsonSchema } from './algo.js'
import { algorandAddressCandidateSchema, algorandTransactionIdSchema } from './classifier.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { transactionDetailDataSchema } from './transactions.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'
import type { ResultIdentity } from './live-payment.js'

/** The JSON-safe wire subset of lookup_transaction this slice consumes. */
export const transactionWireSchema = z.object({
  id: algorandTransactionIdSchema,
  type: z.string().min(1).optional(),
  sender: algorandAddressCandidateSchema,
  fee: z.number().finite().nonnegative().describe('ALGO float on the tool wire'),
  confirmedRound: z.number().int().nonnegative().optional(),
  roundTime: z.number().int().nonnegative().optional(),
  paymentAmount: z.number().finite().nonnegative().optional(),
  receiver: algorandAddressCandidateSchema.optional(),
  assetId: z.number().int().nonnegative().optional(),
  assetAmount: uint64JsonSchema.optional(),
  assetName: z.string().min(1).optional(),
  assetUnitName: z.string().min(1).optional(),
  assetDecimals: z.number().int().nonnegative().optional(),
  applicationId: z.number().int().nonnegative().optional(),
  onCompletion: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
  group: z.string().min(1).optional(),
  innerTxns: z.array(z.unknown()).optional(),
  rekeyTo: algorandAddressCandidateSchema.optional(),
  closeTo: algorandAddressCandidateSchema.optional(),
  closeAmount: z.union([z.number(), uint64JsonSchema]).optional(),
  clawbackFrom: algorandAddressCandidateSchema.optional(),
})

/**
 * Wraps a lookup_transaction result as a transaction detail record. The tool
 * wire carries ALGO floats; converted back to microALGOs here (same
 * freeze-review follow-up as accounts: tools should expose microALGOs).
 */
export function buildTransactionDetailRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_transaction',
): StructuredResult {
  const txn = transactionWireSchema.parse(wire)
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
      feeMicroAlgos: Math.round(txn.fee * 1_000_000),
      ...(txn.receiver === undefined ? {} : { receiver: txn.receiver }),
      ...(txn.paymentAmount === undefined
        ? {}
        : { paymentAmountMicroAlgos: Math.round(txn.paymentAmount * 1_000_000) }),
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
      ...(txn.closeAmount === undefined
        ? {}
        : txn.type === 'pay' && typeof txn.closeAmount === 'number'
          ? { closeAmountMicroAlgos: Math.round(txn.closeAmount * 1_000_000) }
          : { closeAssetAmount: txn.closeAmount }),
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
