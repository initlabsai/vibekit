import type algosdk from 'algosdk'
import { formatAsset, formatAssetAmount, formatTransaction } from '../formatters'
import type { FormattedAsset, FormattedTransaction, AssetBalance } from '../types'
import { DEFAULT_LIMIT, stripFinalToken } from '../types'

export interface LookupAssetArgs {
  assetId: number
}

export async function lookupAsset(
  indexer: algosdk.Indexer,
  args: LookupAssetArgs
): Promise<FormattedAsset> {
  const response = await indexer.lookupAssetByID(args.assetId).do()
  return formatAsset(response.asset)
}

export interface SearchAssetBalancesArgs {
  assetId: number
  limit?: number
  nextToken?: string
  currencyGreaterThan?: number
  currencyLessThan?: number
}

export async function searchAssetBalances(
  indexer: algosdk.Indexer,
  args: SearchAssetBalancesArgs
): Promise<{ balances: AssetBalance[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  // Always fetch max from API so client-side sort has the largest pool
  let query = indexer.lookupAssetBalances(args.assetId).limit(100)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.currencyGreaterThan !== undefined)
    query = query.currencyGreaterThan(args.currencyGreaterThan)
  if (args.currencyLessThan !== undefined) query = query.currencyLessThan(args.currencyLessThan)

  const response = await query.do()

  // Fetch asset decimals for formatting
  let decimals = 0
  try {
    const assetRes = await indexer.lookupAssetByID(args.assetId).do()
    decimals = Number(assetRes.asset.params.decimals ?? 0)
  } catch {
    /* fall back to raw amounts */
  }

  const allBalances = (response.balances ?? [])
    .map((b) => ({
      address: String(b.address),
      amount: formatAssetAmount(String(b.amount), decimals),
      rawAmount: BigInt(b.amount),
      isFrozen: b.isFrozen,
    }))
    .sort((a, b) => (b.rawAmount > a.rawAmount ? 1 : b.rawAmount < a.rawAmount ? -1 : 0))
    .map(({ rawAmount: _, ...rest }) => rest)

  // Truncate to requested limit after sorting
  const balances = allBalances.slice(0, limit)

  return {
    balances,
    nextToken: stripFinalToken(allBalances.length, 100, response.nextToken),
  }
}

export interface SearchAssetTransactionsArgs {
  assetId: number
  limit?: number
  nextToken?: string
  beforeTime?: string
  afterTime?: string
}

export async function searchAssetTransactions(
  indexer: algosdk.Indexer,
  args: SearchAssetTransactionsArgs
): Promise<{ transactions: FormattedTransaction[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.searchForTransactions().assetID(args.assetId).limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.beforeTime) query = query.beforeTime(args.beforeTime)
  if (args.afterTime) query = query.afterTime(args.afterTime)

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
  indexer: algosdk.Indexer,
  args: SearchAssetsArgs
): Promise<{ assets: FormattedAsset[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.searchForAssets().limit(limit)

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
