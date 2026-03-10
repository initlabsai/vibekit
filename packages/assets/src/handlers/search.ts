import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { DEFAULT_LIMIT, stripFinalToken, formatAssetAmount } from '@vibekit/core'
import type { FormattedAsset, AssetBalance } from '../types'

type IndexerAsset = InstanceType<typeof import('algosdk').indexerModels.Asset>
type IndexerTransaction = InstanceType<typeof import('algosdk').indexerModels.Transaction>

const MICROALGOS_PER_ALGO = 1_000_000

function formatAsset(asset: IndexerAsset): FormattedAsset {
  const params = asset.params
  return {
    assetId: Number(asset.index),
    name: params.name,
    unitName: params.unitName,
    totalSupply: String(params.total),
    decimals: params.decimals,
    creator: params.creator ? String(params.creator) : undefined,
    manager: params.manager ? String(params.manager) : undefined,
    reserve: params.reserve ? String(params.reserve) : undefined,
    freeze: params.freeze ? String(params.freeze) : undefined,
    clawback: params.clawback ? String(params.clawback) : undefined,
    defaultFrozen: params.defaultFrozen,
    url: params.url,
  }
}

interface FormattedTransaction {
  id: string
  type: string
  sender: string
  fee: number
  confirmedRound?: number
  roundTime?: number
  paymentAmount?: number
  receiver?: string
  assetId?: number
  assetAmount?: number | string
  applicationId?: number
  note?: string
  group?: string
  innerTxns?: FormattedTransaction[]
  globalStateDelta?: unknown
  localStateDelta?: unknown
  logs?: string[]
}

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

export interface SearchAssetBalancesArgs {
  assetId: number
  limit?: number
  nextToken?: string
  currencyGreaterThan?: number
  currencyLessThan?: number
}

export async function searchAssetBalances(
  algorand: AlgorandClient,
  args: SearchAssetBalancesArgs
): Promise<{ balances: AssetBalance[]; nextToken?: string }> {
  const indexer = algorand.client.indexer
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.lookupAssetBalances(args.assetId).limit(100)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.currencyGreaterThan !== undefined) query = query.currencyGreaterThan(args.currencyGreaterThan)
  if (args.currencyLessThan !== undefined) query = query.currencyLessThan(args.currencyLessThan)

  const response = await query.do()

  let decimals = 0
  try {
    const assetRes = await indexer.lookupAssetByID(args.assetId).do()
    decimals = Number(assetRes.asset.params.decimals ?? 0)
  } catch { /* fall back to raw amounts */ }

  const allBalances = (response.balances ?? [])
    .map((b) => ({
      address: String(b.address),
      amount: formatAssetAmount(String(b.amount), decimals),
      rawAmount: BigInt(b.amount),
      isFrozen: b.isFrozen,
    }))
    .sort((a, b) => (b.rawAmount > a.rawAmount ? 1 : b.rawAmount < a.rawAmount ? -1 : 0))
    .map(({ rawAmount: _, ...rest }) => rest)

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
  algorand: AlgorandClient,
  args: SearchAssetTransactionsArgs
): Promise<{ transactions: FormattedTransaction[]; nextToken?: string }> {
  const indexer = algorand.client.indexer
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
  algorand: AlgorandClient,
  args: SearchAssetsArgs
): Promise<{ assets: FormattedAsset[]; nextToken?: string }> {
  const indexer = algorand.client.indexer
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
