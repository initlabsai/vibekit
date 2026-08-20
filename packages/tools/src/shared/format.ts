import { bytesToBase64 } from '@initlabs/vibekit-core'
import { z } from 'zod'

const MICROALGOS_PER_ALGO = 1_000_000

type IndexerTransaction = InstanceType<typeof import('algosdk').indexerModels.Transaction>

/** Formatted transaction returned by handlers. */
export interface FormattedTransaction {
  /** Absent on inner transactions — the indexer assigns them no id. */
  id?: string
  type?: string
  sender: string
  /** In ALGO, not microALGO. */
  fee: number
  confirmedRound?: number
  roundTime?: number
  /** In ALGO, not microALGO. */
  paymentAmount?: number
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
  /** Pay: ALGO float. Axfer: base units. */
  closeAmount?: number | string
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
  fee: z.number().describe('Fee in ALGO (not microALGO)'),
  confirmedRound: z.number().optional(),
  roundTime: z.number().optional(),
  paymentAmount: z.number().optional().describe('Payment amount in ALGO (not microALGO)'),
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
  closeAmount: z.union([z.number(), z.string()]).optional(),
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
function uint64(value: bigint): number | string {
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString()
}

export function formatTransaction(tx: IndexerTransaction): FormattedTransaction {
  const formatted: FormattedTransaction = {
    // Inner transactions carry no indexer-assigned id, and txType is optional
    // in the model — leave the keys absent rather than asserting.
    id: tx.id,
    type: tx.txType,
    sender: String(tx.sender),
    fee: Number(tx.fee) / MICROALGOS_PER_ALGO,
    confirmedRound: tx.confirmedRound != null ? Number(tx.confirmedRound) : undefined,
    roundTime: tx.roundTime != null ? Number(tx.roundTime) : undefined,
  }
  if (tx.rekeyTo) formatted.rekeyTo = String(tx.rekeyTo)
  if (tx.paymentTransaction) {
    formatted.paymentAmount = Number(tx.paymentTransaction.amount) / MICROALGOS_PER_ALGO
    formatted.receiver = String(tx.paymentTransaction.receiver)
    if (tx.paymentTransaction.closeRemainderTo) {
      formatted.closeTo = String(tx.paymentTransaction.closeRemainderTo)
    }
    if (tx.paymentTransaction.closeAmount != null) {
      formatted.closeAmount = Number(tx.paymentTransaction.closeAmount) / MICROALGOS_PER_ALGO
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
      formatted.closeAmount = uint64(tx.assetTransferTransaction.closeAmount)
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
