import { DEFAULT_LIMIT, stripFinalToken, type ToolContext } from '@initlabs/vibekit-core'
import { formatTransaction, type FormattedTransaction } from '../../shared/format.js'
import { formatAsset, type AssetBalance, type FormattedAsset } from './format.js'

export interface SearchAssetBalancesArgs {
  assetId: number
  limit?: number
  nextToken?: string
  currencyGreaterThan?: number
  currencyLessThan?: number
}

export async function searchAssetBalances(
  ctx: ToolContext,
  args: SearchAssetBalancesArgs,
): Promise<{ balances: AssetBalance[]; nextToken?: string }> {
  const indexer = ctx.indexer
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.lookupAssetBalances(args.assetId).limit(100)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.currencyGreaterThan !== undefined)
    query = query.currencyGreaterThan(args.currencyGreaterThan)
  if (args.currencyLessThan !== undefined) query = query.currencyLessThan(args.currencyLessThan)

  const response = await query.do()

  let decimals: number | undefined
  try {
    const assetRes = await indexer.lookupAssetByID(args.assetId).do()
    decimals = Number(assetRes.asset.params.decimals ?? 0)
  } catch {
    /* decimals stay unknown; amounts are raw base units regardless */
  }

  const allBalances = (response.balances ?? [])
    .map((b) => ({
      address: String(b.address),
      amount: String(b.amount),
      rawAmount: BigInt(b.amount),
      isFrozen: b.isFrozen,
    }))
    .sort((a, b) => (b.rawAmount > a.rawAmount ? 1 : b.rawAmount < a.rawAmount ? -1 : 0))
    .map(({ rawAmount: _, ...rest }) => rest)

  const balances = allBalances.slice(0, limit)

  return {
    balances,
    ...(decimals === undefined ? {} : { decimals }),
    nextToken: stripFinalToken(allBalances.length, 100, response.nextToken),
  }
}

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
