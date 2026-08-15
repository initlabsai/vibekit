import { stripFinalToken, type ToolContext } from '@initlabs/vibekit-core'
import { formatTransaction, type FormattedTransaction } from './format.js'

export async function lookupTransaction(
  ctx: ToolContext,
  args: { txid: string },
): Promise<FormattedTransaction> {
  const response = await ctx.indexer.lookupTransactionByID(args.txid).do()
  return formatTransaction(response.transaction)
}

export async function lookupTransactionGroup(
  ctx: ToolContext,
  args: { groupId: string },
): Promise<{ transactions: FormattedTransaction[]; nextToken?: string }> {
  const response = await ctx.indexer.searchForTransactions().groupid(args.groupId).limit(100).do()
  const transactions = (response.transactions ?? []).map(formatTransaction)
  return {
    transactions,
    nextToken: stripFinalToken(transactions.length, 100, response.nextToken),
  }
}
