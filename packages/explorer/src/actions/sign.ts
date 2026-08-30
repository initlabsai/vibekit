/**
 * Signing an approved draft with any algosdk-style signer. Only the legs the
 * draft leaves to the wallet are offered to it; pre-signed legs (a router's)
 * are spliced back in place. Browser-safe: algosdk decode only, no node.
 */
import algosdk from 'algosdk'
import { base64ToBytes, bytesToBase64 } from '@initlabs/vibekit'

import type { StructuredResult } from '../core/results.js'
import { writeDraftDataSchema } from './reducer.js'

/** `(txnGroup, indexesToSign) => signed bytes` — algosdk's TransactionSigner, use-wallet's `transactionSigner`, a keystore's. */
export type DraftSigner = (
  txnGroup: algosdk.Transaction[],
  indexesToSign: number[],
) => Promise<Uint8Array[]>

/** Decodes a draft record's group into algosdk transactions for a signer. */
export function unsignedTransactionsForDraft(draftRecord: StructuredResult): algosdk.Transaction[] {
  if (draftRecord.state !== 'success') {
    throw new Error('Cannot decode a failed draft record')
  }
  const draft = writeDraftDataSchema.parse(draftRecord.data)
  return draft.unsignedGroup.transactions.map((txn) =>
    algosdk.decodeUnsignedTransaction(base64ToBytes(txn)),
  )
}

/**
 * Signs the wallet's legs of a draft and returns the full group in order,
 * base64 per transaction. Verification of what came back is the record
 * builder's job (`signedGroupRecordFor`), server-side where there is one.
 */
export async function signGroupForDraft(
  draftRecord: StructuredResult,
  signer: DraftSigner,
): Promise<string[]> {
  const transactions = unsignedTransactionsForDraft(draftRecord)
  const presigned =
    draftRecord.state === 'success'
      ? writeDraftDataSchema.parse(draftRecord.data).presigned
      : undefined
  const indexes = transactions.map((_, index) => index).filter((index) => !presigned?.[index])
  const signed = await signer(transactions, indexes)
  if (signed.length !== indexes.length) {
    throw new Error(
      `The wallet returned ${signed.length} signatures for ${indexes.length} transactions`,
    )
  }
  return transactions.map(
    (_, index) => presigned?.[index] ?? bytesToBase64(signed[indexes.indexOf(index)]!),
  )
}

/**
 * Builds an `ActionHost.signDraft` from a wallet signer. Signing runs only
 * when the action controller asks — after a recorded approval — and refuses
 * when the wallet is on a different network than the draft. `record` turns
 * the signed bytes into the signed record: a server route that verifies them
 * (the browser is not trusted to claim what it signed), or `signedGroupRecordFor`
 * in-process.
 */
export function createWalletSignDraft(args: {
  network: string
  walletNetwork: () => string
  signer: DraftSigner
  record: (draftRecord: StructuredResult, signedTransactions: string[]) => Promise<StructuredResult>
}): (draftRecord: StructuredResult) => Promise<StructuredResult> {
  return async (draftRecord) => {
    const walletNetwork = args.walletNetwork()
    if (walletNetwork !== args.network) {
      throw new Error(`Wallet is on ${walletNetwork}; the draft is on ${args.network}`)
    }
    return args.record(draftRecord, await signGroupForDraft(draftRecord, args.signer))
  }
}
