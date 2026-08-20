import { bytesToBase64 } from '@initlabs/vibekit-core'
import { z } from 'zod'

type IndexerTransaction = InstanceType<typeof import('algosdk').indexerModels.Transaction>

/** Formatted transaction returned by handlers. */
export interface FormattedTransaction {
  /** Absent on inner transactions — the indexer assigns them no id. */
  id?: string
  type?: string
  sender: string
  /** microALGOs; decimal string when the uint64 exceeds 2^53. */
  feeMicroAlgos: number | string
  confirmedRound?: number
  roundTime?: number
  /** microALGOs; decimal string when the uint64 exceeds 2^53. */
  paymentAmountMicroAlgos?: number | string
  receiver?: string
  assetId?: number
  /** Base units; decimal string when the uint64 exceeds 2^53. */
  assetAmount?: number | string
  assetName?: string
  assetUnitName?: string
  assetDecimals?: number
  applicationId?: number
  onCompletion?: string
  note?: string
  group?: string
  rekeyTo?: string
  closeTo?: string
  /** Pay close-out amount in microALGOs; decimal string above 2^53. */
  closeAmountMicroAlgos?: number | string
  /** Axfer close-out amount in base units; decimal string above 2^53. */
  closeAssetAmount?: number | string
  clawbackFrom?: string
  innerTxns?: FormattedTransaction[]
  globalStateDelta?: unknown
  localStateDelta?: unknown
  logs?: string[]
}

/** Post-jsonSafe wire shape of {@link FormattedTransaction}. */
export const formattedTransactionSchema = z.object({
  // The indexer assigns no id to inner transactions, and txType is optional
  // in the indexer model — both keys are absent when unset (jsonSafe drops
  // undefined entries).
  id: z.string().optional(),
  type: z.string().optional(),
  sender: z.string(),
  feeMicroAlgos: z
    .union([z.number(), z.string()])
    .describe('Fee in microALGOs (1 ALGO = 1,000,000 microALGOs); decimal string when above 2^53'),
  confirmedRound: z.number().optional(),
  roundTime: z.number().optional(),
  paymentAmountMicroAlgos: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      'Payment amount in microALGOs (1 ALGO = 1,000,000 microALGOs); decimal string when above 2^53',
    ),
  receiver: z.string().optional(),
  assetId: z.number().optional(),
  assetAmount: z
    .union([z.number(), z.string()])
    .optional()
    .describe('Asset amount in base units; decimal string when above 2^53'),
  applicationId: z.number().optional(),
  onCompletion: z.string().optional(),
  assetName: z.string().optional(),
  assetUnitName: z.string().optional(),
  assetDecimals: z.number().int().nonnegative().optional(),
  rekeyTo: z.string().optional(),
  closeTo: z.string().optional(),
  closeAmountMicroAlgos: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      'Pay close-out amount in microALGOs (1 ALGO = 1,000,000 microALGOs); decimal string when above 2^53',
    ),
  closeAssetAmount: z
    .union([z.number(), z.string()])
    .optional()
    .describe('Axfer close-out amount in base units; decimal string when above 2^53'),
  clawbackFrom: z.string().optional(),
  note: z.string().optional(),
  group: z.string().optional(),
  get innerTxns() {
    return z.array(formattedTransactionSchema).optional()
  },
  globalStateDelta: z.unknown().optional(),
  localStateDelta: z.unknown().optional(),
  logs: z.array(z.string()).optional(),
})

/** Wire shape of every transaction-list tool result ('transaction.list' view). */
export const transactionListSchema = z.object({
  transactions: z.array(formattedTransactionSchema),
  nextToken: z.string().optional(),
})

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
  }
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
