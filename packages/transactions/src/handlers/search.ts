import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { DEFAULT_LIMIT, stripFinalToken } from '@vibekit/core'
import type { FormattedTransaction } from '../types'

const MICROALGOS_PER_ALGO = 1_000_000
type IndexerTransaction = InstanceType<typeof import('algosdk').indexerModels.Transaction>

function formatTransaction(tx: IndexerTransaction): FormattedTransaction {
  const formatted: FormattedTransaction = {
    id: tx.id!,
    type: tx.txType as string,
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
    formatted.assetAmount = Number(tx.assetTransferTransaction.amount)
    formatted.receiver = String(tx.assetTransferTransaction.receiver)
  }
  if (tx.applicationTransaction) formatted.applicationId = Number(tx.applicationTransaction.applicationId)
  if (tx.note && tx.note.length > 0) {
    try { formatted.note = new TextDecoder().decode(tx.note) } catch { formatted.note = Buffer.from(tx.note).toString('base64') }
  }
  if (tx.group) formatted.group = Buffer.from(tx.group).toString('base64')
  if (tx.innerTxns && tx.innerTxns.length > 0) formatted.innerTxns = tx.innerTxns.map(formatTransaction)
  if (tx.globalStateDelta) formatted.globalStateDelta = tx.globalStateDelta
  if (tx.localStateDelta) formatted.localStateDelta = tx.localStateDelta
  if (tx.logs && tx.logs.length > 0) formatted.logs = tx.logs.map((l) => Buffer.from(l).toString('base64'))
  return formatted
}

export interface SearchTransactionsArgs {
  limit?: number
  nextToken?: string
  txType?: string
  assetId?: number
  minRound?: number
  maxRound?: number
  beforeTime?: string
  afterTime?: string
  minAmount?: number
  applicationId?: number
}

export async function searchTransactions(
  algorand: AlgorandClient,
  args: SearchTransactionsArgs
): Promise<{ transactions: FormattedTransaction[]; nextToken?: string }> {
  const indexer = algorand.client.indexer
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.searchForTransactions().limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.txType) query = query.txType(args.txType)
  if (args.assetId) query = query.assetID(args.assetId)
  if (args.minRound) query = query.minRound(args.minRound)
  if (args.maxRound) query = query.maxRound(args.maxRound)
  if (args.beforeTime) query = query.beforeTime(args.beforeTime)
  if (args.afterTime) query = query.afterTime(args.afterTime)
  if (args.minAmount) query = query.currencyGreaterThan(args.minAmount - 1)
  if (args.applicationId) query = query.applicationID(args.applicationId)

  const response = await query.do()
  const transactions = (response.transactions ?? []).map(formatTransaction)
  return {
    transactions,
    nextToken: stripFinalToken(transactions.length, limit, response.nextToken),
  }
}
