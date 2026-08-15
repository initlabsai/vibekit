import { DEFAULT_LIMIT, stripFinalToken, type ToolContext } from '@initlabs/core'
import { formatTransaction, type FormattedTransaction } from './format.js'

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
  ctx: ToolContext,
  args: SearchTransactionsArgs,
): Promise<{ transactions: FormattedTransaction[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = ctx.indexer.searchForTransactions().limit(limit)

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
