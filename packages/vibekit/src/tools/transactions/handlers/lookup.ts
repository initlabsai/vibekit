import { stripFinalToken, type ToolContext } from '../../../core/index.js'
import { enrichAssetParams } from '../../shared/asset-params.js'
import { formatTransaction, type FormattedTransaction } from '../../shared/format.js'

export async function lookupTransaction(
  ctx: ToolContext,
  args: { txid: string },
): Promise<FormattedTransaction> {
  const response = await ctx.indexer.lookupTransactionByID(args.txid).do()
  const formatted = formatTransaction(response.transaction)
  await enrichAssetParams(ctx, [formatted])
  return formatted
}

export async function lookupTransactionGroup(
  ctx: ToolContext,
  args: { groupId: string },
): Promise<{ groupId: string; transactions: FormattedTransaction[]; nextToken?: string }> {
  const response = await ctx.indexer.searchForTransactions().groupid(args.groupId).limit(100).do()
  const transactions = (response.transactions ?? []).map(formatTransaction)
  await enrichAssetParams(ctx, transactions)
  return {
    groupId: args.groupId,
    transactions,
    nextToken: stripFinalToken(transactions.length, 100, response.nextToken),
  }
}
