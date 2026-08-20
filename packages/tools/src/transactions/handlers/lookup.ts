import { stripFinalToken, type ToolContext } from '@initlabs/vibekit-core'
import { formatTransaction, type FormattedTransaction } from './format.js'

export async function lookupTransaction(
  ctx: ToolContext,
  args: { txid: string },
): Promise<FormattedTransaction> {
  const response = await ctx.indexer.lookupTransactionByID(args.txid).do()
  const formatted = formatTransaction(response.transaction)
  if (formatted.assetId === undefined) return formatted
  try {
    const asset = await ctx.algod.getAssetByID(BigInt(formatted.assetId)).do()
    const params = asset.params
    if (!params) return formatted
    if (params.name) formatted.assetName = params.name
    if (params.unitName) formatted.assetUnitName = params.unitName
    if (params.decimals != null) formatted.assetDecimals = Number(params.decimals)
  } catch {
    // Asset params are presentation enrichment; the transfer still renders.
  }
  return formatted
}

export async function lookupTransactionGroup(
  ctx: ToolContext,
  args: { groupId: string },
): Promise<{ groupId: string; transactions: FormattedTransaction[]; nextToken?: string }> {
  const response = await ctx.indexer.searchForTransactions().groupid(args.groupId).limit(100).do()
  const transactions = (response.transactions ?? []).map(formatTransaction)
  return {
    groupId: args.groupId,
    transactions,
    nextToken: stripFinalToken(transactions.length, 100, response.nextToken),
  }
}
