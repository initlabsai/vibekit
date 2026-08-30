/**
 * From a compose-mode wire result to a draft record: decode the actual
 * unsigned group bytes for the facts an approval shows (sender, fee, types,
 * a payment's receiver and amount), never the request parameters.
 */
import algosdk from 'algosdk'

import { base64ToBytes, bytesToBase64 } from '../core/codec.js'
import { formatAlgodTransaction, printableNote, safeUint64 } from './algod-txn.js'
import { buildDraftRecord, buildSignedGroupRecord, decodedGroupFactsSchema, type DecodedGroupFacts } from './host.js'
import { draftDataSchema } from './reducer.js'
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


/**
 * Wraps signer output as a signed-group record after verifying that every
 * signed transaction embeds exactly the draft's bytes — a signature over
 * anything but the approved group is refused, not recorded.
 */
export function signedGroupRecordFor(
  identity: { resultId: string; toolCallId: string; network: string },
  draftRecord: StructuredResult,
  signedTransactions: readonly Uint8Array[],
): StructuredResult {
  if (draftRecord.state !== 'success') {
    throw new Error('Cannot sign a failed draft record')
  }
  const draft = draftDataSchema.parse(draftRecord.data)
  if (signedTransactions.length !== draft.unsignedGroup.transactions.length) {
    throw new Error('Signed group size does not match the drafted group')
  }
  const txIds: string[] = []
  for (const [index, signed] of signedTransactions.entries()) {
    const presigned = draft.presigned?.[index]
    if (presigned !== undefined && presigned !== null) {
      // Another party's leg: the only acceptable bytes are the ones the draft carried.
      if (bytesToBase64(signed) !== presigned) {
        throw new Error(`Transaction ${index} is not the pre-signed leg the draft carried`)
      }
    } else {
      const decoded = algosdk.decodeSignedTransaction(signed)
      const embedded = bytesToBase64(algosdk.encodeUnsignedTransaction(decoded.txn))
      if (embedded !== draft.unsignedGroup.transactions[index]) {
        throw new Error(`Signed transaction ${index} does not wrap the drafted bytes`)
      }
    }
    txIds.push(algosdk.decodeSignedTransaction(signed).txn.txID())
  }
  return buildSignedGroupRecord(identity, {
    transactions: signedTransactions.map((signed) => bytesToBase64(signed)),
    txIds,
    signer: draft.sender,
  })
}

