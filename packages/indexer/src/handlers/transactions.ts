import type algosdk from 'algosdk'
import { formatTransaction } from '../formatters.js'
import type { FormattedTransaction } from '../types.js'
import { DEFAULT_LIMIT } from '../types.js'

export interface LookupTransactionArgs {
  txid: string
}

export async function lookupTransaction(
  indexer: algosdk.Indexer,
  args: LookupTransactionArgs
): Promise<FormattedTransaction> {
  const response = await indexer.lookupTransactionByID(args.txid).do()
  return formatTransaction(response.transaction)
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
  indexer: algosdk.Indexer,
  args: SearchTransactionsArgs
): Promise<{ transactions: FormattedTransaction[]; nextToken?: string }> {
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
  return {
    transactions: (response.transactions ?? []).map(formatTransaction),
    nextToken: response.nextToken,
  }
}
