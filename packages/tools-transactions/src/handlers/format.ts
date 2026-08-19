import { bytesToBase64 } from '@initlabs/vibekit-core'

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
  applicationId?: number
  note?: string
  group?: string
  innerTxns?: FormattedTransaction[]
  globalStateDelta?: unknown
  localStateDelta?: unknown
  logs?: string[]
}

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
  if (tx.paymentTransaction) {
    formatted.paymentAmount = Number(tx.paymentTransaction.amount) / MICROALGOS_PER_ALGO
    formatted.receiver = String(tx.paymentTransaction.receiver)
  }
  if (tx.assetTransferTransaction) {
    formatted.assetId = Number(tx.assetTransferTransaction.assetId)
    formatted.assetAmount = uint64(tx.assetTransferTransaction.amount)
    formatted.receiver = String(tx.assetTransferTransaction.receiver)
  }
  if (tx.applicationTransaction)
    formatted.applicationId = Number(tx.applicationTransaction.applicationId)
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
