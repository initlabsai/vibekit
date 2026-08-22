import { DEFAULT_LIMIT, stripFinalToken, type ToolContext } from '@initlabs/vibekit-core'
import { formatTransaction, type FormattedTransaction } from '../../shared/format.js'
import { transactionQueryOf, type TransactionQuery } from '../../shared/schemas.js'

export interface SearchTransactionsArgs {
  limit?: number
  nextToken?: string
  txType?: string
  assetId?: number
  minRound?: number
  maxRound?: number
  beforeTime?: string
  afterTime?: string
  maxAmount?: number
  minAmount?: number
  applicationId?: number
  notePrefix?: string
}

export async function searchTransactions(
  ctx: ToolContext,
  args: SearchTransactionsArgs,
): Promise<{ transactions: FormattedTransaction[]; nextToken?: string; query?: TransactionQuery }> {
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
  if (args.maxAmount !== undefined) query = query.currencyLessThan(args.maxAmount + 1)
  if (args.applicationId) query = query.applicationID(args.applicationId)
  if (args.notePrefix) query = query.notePrefix(new TextEncoder().encode(args.notePrefix))

  const response = await query.do()
  const transactions = (response.transactions ?? []).map(formatTransaction)
  return {
    transactions,
    nextToken: stripFinalToken(transactions.length, limit, response.nextToken),
    query: transactionQueryOf(args),
  }
}
