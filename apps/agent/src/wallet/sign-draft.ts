/**
 * The browser's `signDraft`: decode the approved draft's group bytes, hand
 * them to the connected wallet's signer, then post the signed bytes to the
 * server, which verifies they wrap the drafted bytes before recording them.
 * Decode is a local copy of the live host's; verification stays server-side
 * because the browser is not trusted to claim what it signed.
 */
import algosdk from 'algosdk'
import {
  structuredResultSchema,
  writeDraftDataSchema,
  type LiveNetworkId,
  type StructuredResult,
} from '@initlabs/vibekit-explorer'

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64')
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

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

export type TransactionSigner = (
  txnGroup: algosdk.Transaction[],
  indexesToSign: number[],
) => Promise<Uint8Array[]>

/**
 * Builds the `signDraft` a connected wallet gives the remote host. Signing
 * runs only when the flow controller asks — after a recorded approval — and
 * refuses when the wallet is on a different network than the Explorer.
 */
export function createWalletSignDraft(args: {
  network: LiveNetworkId
  walletNetwork: () => string
  transactionSigner: TransactionSigner
}): (draftRecord: StructuredResult) => Promise<StructuredResult> {
  return async (draftRecord) => {
    const walletNetwork = args.walletNetwork()
    if (walletNetwork !== args.network) {
      throw new Error(`Wallet is on ${walletNetwork}; Explorer is on ${args.network}`)
    }
    const transactions = unsignedTransactionsForDraft(draftRecord)
    // A router's legs arrive signed by the router; the wallet sees only its own.
    const presigned =
      draftRecord.state === 'success'
        ? writeDraftDataSchema.parse(draftRecord.data).presigned
        : undefined
    const indexes = transactions.map((_, index) => index).filter((index) => !presigned?.[index])
    const signed = await args.transactionSigner(transactions, indexes)
    if (signed.length !== indexes.length)
      throw new Error(
        `The wallet returned ${signed.length} signatures for ${indexes.length} transactions`,
      )
    const group = transactions.map(
      (_, index) => presigned?.[index] ?? bytesToBase64(signed[indexes.indexOf(index)]!),
    )
    const response = await fetch('/api/explorer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'record-signed',
        network: args.network,
        draftRecord,
        signedTransactions: group,
      }),
    })
    const payload = (await response.json()) as { record?: unknown; error?: string }
    if (!response.ok) throw new Error(payload.error ?? `Signing was refused (${response.status})`)
    return structuredResultSchema.parse(payload.record)
  }
}
