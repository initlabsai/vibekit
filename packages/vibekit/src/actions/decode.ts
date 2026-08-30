/**
 * From a compose-mode wire result to a draft record: decode the actual
 * unsigned group bytes for the facts an approval shows (sender, fee, types,
 * a payment's receiver and amount), never the request parameters.
 */
import algosdk from 'algosdk'

import { base64ToBytes } from '../core/codec.js'
import { formatAlgodTransaction, printableNote, safeUint64 } from './algod-txn.js'
import { buildDraftRecord, decodedGroupFactsSchema, type DecodedGroupFacts } from './host.js'
import type { StructuredResult } from './records.js'

/**
 * Decodes the authoritative facts of an unsigned group of 1–16 transactions.
 * Payment receiver/amount are filled only when every transaction is a plain pay
 * and there is exactly one of them — mixed groups stay group-shaped.
 */
export function decodeUnsignedGroup(
  transactions: readonly string[],
  presigned?: readonly (string | null)[],
): DecodedGroupFacts {
  if (transactions.length === 0 || transactions.length > 16) {
    throw new Error(`Unsupported group size: ${transactions.length}`)
  }
  const decoded = transactions.map((entry) =>
    algosdk.decodeUnsignedTransaction(base64ToBytes(entry)),
  )
  const graphTransactions = decoded.map((txn) => formatAlgodTransaction(txn))
  let fee = 0n
  for (const txn of decoded) fee += BigInt(txn.fee)
  const types = decoded.map((txn) => String(txn.type))
  const note = printableNote(decoded[0]?.note)
  const singlePay =
    decoded.length === 1 &&
    decoded[0]!.type === algosdk.TransactionType.pay &&
    decoded[0]!.payment &&
    decoded[0]!.payment.closeRemainderTo === undefined
  // The sender is whoever the wallet signs for: the first leg that is not another party's.
  const walletIndex = presigned
    ? Math.max(
        0,
        presigned.findIndex((leg) => leg === null),
      )
    : 0
  return decodedGroupFactsSchema.parse({
    sender: decoded[walletIndex]!.sender.toString(),
    ...(singlePay
      ? {
          receiver: decoded[0]!.payment!.receiver.toString(),
          amountMicroAlgos: safeUint64(decoded[0]!.payment!.amount),
        }
      : {}),
    feeMicroAlgos: safeUint64(fee),
    ...(note === undefined ? {} : { note }),
    transactionTypes: types,
    graphTransactions,
  })
}

/** Builds a draft record from a compose-mode unsigned-group wire result. */
export function draftRecordFromComposeWire(
  identity: { resultId: string; toolCallId: string; network: string },
  wire: unknown,
  toolName = 'send_payment',
): StructuredResult {
  const { unsignedGroup, presigned } = wire as {
    unsignedGroup: string[]
    presigned?: (string | null)[]
  }
  const decoded = decodeUnsignedGroup(unsignedGroup, presigned)
  return buildDraftRecord(identity, wire, decoded, toolName)
}

