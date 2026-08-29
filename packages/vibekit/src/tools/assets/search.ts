import { DEFAULT_LIMIT, stripFinalToken, type ToolContext } from '../../core/index.js'
import { formatTransaction, type FormattedTransaction } from '../shared/format.js'
import { formatAsset, type FormattedAsset } from './format.js'

export interface SearchAssetTransactionsArgs {
  assetId: number
  limit?: number
  nextToken?: string
  beforeTime?: string
  afterTime?: string
  minAmount?: number
  maxAmount?: number
  notePrefix?: string
}

export async function searchAssetTransactions(
  ctx: ToolContext,
  args: SearchAssetTransactionsArgs,
): Promise<{ transactions: FormattedTransaction[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = ctx.indexer.searchForTransactions().assetID(args.assetId).limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.beforeTime) query = query.beforeTime(args.beforeTime)
  if (args.afterTime) query = query.afterTime(args.afterTime)
  if (args.minAmount) query = query.currencyGreaterThan(args.minAmount - 1)
  if (args.maxAmount !== undefined) query = query.currencyLessThan(args.maxAmount + 1)
  if (args.notePrefix) query = query.notePrefix(new TextEncoder().encode(args.notePrefix))

  const response = await query.do()
  const transactions = (response.transactions ?? []).map(formatTransaction)
  return {
    transactions,
    nextToken: stripFinalToken(transactions.length, limit, response.nextToken),
  }
}

export interface SearchAssetsArgs {
  limit?: number
  nextToken?: string
  name?: string
  unit?: string
  creator?: string
}

export async function searchAssets(
  ctx: ToolContext,
  args: SearchAssetsArgs,
): Promise<{ assets: FormattedAsset[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = ctx.indexer.searchForAssets().limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.name) query = query.name(args.name)
  if (args.unit) query = query.unit(args.unit)
  if (args.creator) query = query.creator(args.creator)

  const response = await query.do()
  const assets = (response.assets ?? []).map(formatAsset)
  return {
    assets,
    nextToken: stripFinalToken(assets.length, limit, response.nextToken),
  }
}
