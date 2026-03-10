import type algosdk from 'algosdk'
import { formatAccount, formatAssetAmount, formatTransaction } from '../formatters'
import type {
  FormattedAccount,
  FormattedTransaction,
  AccountAsset,
  AccountAppLocalState,
} from '../types'
import { DEFAULT_LIMIT, stripFinalToken } from '../types'
import { indexerSemaphore as indexerSem } from '@vibekit/core'

export interface LookupAccountArgs {
  address: string
}

export async function lookupAccount(
  indexer: algosdk.Indexer,
  args: LookupAccountArgs
): Promise<FormattedAccount> {
  const response = await indexer.lookupAccountByID(args.address).do()
  return formatAccount(response.account)
}

export async function batchLookupAccounts(
  indexer: algosdk.Indexer,
  args: { addresses: string[] }
): Promise<{ accounts: FormattedAccount[] }> {
  const results = await Promise.allSettled(
    args.addresses.map((address) =>
      indexerSem.run(() =>
        indexer
          .lookupAccountByID(address)
          .do()
          .then((r) => formatAccount(r.account))
      )
    )
  )
  return {
    accounts: results
      .filter((r): r is PromiseFulfilledResult<FormattedAccount> => r.status === 'fulfilled')
      .map((r) => r.value),
  }
}

export interface SearchAccountTransactionsArgs {
  address: string
  limit?: number
  nextToken?: string
  assetId?: number
  txType?: string
  minRound?: number
  maxRound?: number
  beforeTime?: string
  afterTime?: string
  minAmount?: number
}

export async function searchAccountTransactions(
  indexer: algosdk.Indexer,
  args: SearchAccountTransactionsArgs
): Promise<{ transactions: FormattedTransaction[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.searchForTransactions().address(args.address).limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.assetId) query = query.assetID(args.assetId)
  if (args.txType) query = query.txType(args.txType)
  if (args.minRound) query = query.minRound(args.minRound)
  if (args.maxRound) query = query.maxRound(args.maxRound)
  if (args.beforeTime) query = query.beforeTime(args.beforeTime)
  if (args.afterTime) query = query.afterTime(args.afterTime)
  if (args.minAmount) query = query.currencyGreaterThan(args.minAmount - 1)

  const response = await query.do()
  const transactions = (response.transactions ?? []).map(formatTransaction)
  return {
    transactions,
    nextToken: stripFinalToken(transactions.length, limit, response.nextToken),
  }
}

export interface SearchAccountsArgs {
  limit?: number
  nextToken?: string
  assetId?: number
  applicationId?: number
  currencyGreaterThan?: number
  currencyLessThan?: number
}

export async function searchAccounts(
  indexer: algosdk.Indexer,
  args: SearchAccountsArgs
): Promise<{ accounts: FormattedAccount[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.searchAccounts().limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.assetId) query = query.assetID(args.assetId)
  if (args.applicationId) query = query.applicationID(args.applicationId)
  if (args.currencyGreaterThan !== undefined)
    query = query.currencyGreaterThan(args.currencyGreaterThan)
  if (args.currencyLessThan !== undefined) query = query.currencyLessThan(args.currencyLessThan)

  const response = await query.do()
  const accounts = (response.accounts ?? []).map(formatAccount)
  return {
    accounts,
    nextToken: stripFinalToken(accounts.length, limit, response.nextToken),
  }
}

export interface GetAccountAssetsArgs {
  address: string
  limit?: number
  nextToken?: string
}

export async function getAccountAssets(
  indexer: algosdk.Indexer,
  args: GetAccountAssetsArgs
): Promise<{ assets: AccountAsset[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.lookupAccountAssets(args.address).limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)

  const response = await query.do()
  const holdings = (response.assets ?? []).map((a) => ({
    assetId: Number(a.assetId),
    amount: String(a.amount),
    isFrozen: a.isFrozen as boolean,
  }))

  // Enrich holdings with asset metadata (name, unit, decimals)
  const metadataResults = await Promise.allSettled(
    holdings.map((h) => indexerSem.run(() => indexer.lookupAssetByID(h.assetId).do()))
  )

  const assets: AccountAsset[] = holdings.map((h, i) => {
    const meta = metadataResults[i]
    if (meta.status === 'fulfilled') {
      const params = meta.value.asset?.params
      const decimals = params?.decimals != null ? Number(params.decimals) : undefined
      return {
        ...h,
        amount: decimals != null ? formatAssetAmount(h.amount, decimals) : h.amount,
        name: params?.name as string | undefined,
        unitName: params?.unitName as string | undefined,
      }
    }
    return h
  })

  return { assets, nextToken: stripFinalToken(holdings.length, limit, response.nextToken) }
}

export interface GetAccountAppLocalStatesArgs {
  address: string
  limit?: number
  nextToken?: string
  applicationId?: number
}

export async function getAccountAppLocalStates(
  indexer: algosdk.Indexer,
  args: GetAccountAppLocalStatesArgs
): Promise<{ appLocalStates: AccountAppLocalState[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.lookupAccountAppLocalStates(args.address).limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.applicationId) query = query.applicationID(args.applicationId)

  const response = await query.do()
  const appLocalStates = (response.appsLocalStates ?? []).map((state) => ({
      applicationId: Number(state.id),
      schema: {
        numByteSlice: Number(state.schema.numByteSlice),
        numUint: Number(state.schema.numUint),
      },
      keyValue: (state.keyValue ?? []).map((kv) => ({
        key: Buffer.from(kv.key).toString('base64'),
        value: {
          type: kv.value.type,
          bytes: kv.value.bytes ? Buffer.from(kv.value.bytes).toString('base64') : undefined,
          uint: kv.value.uint !== undefined ? Number(kv.value.uint) : undefined,
        },
      })),
    }))

  return {
    appLocalStates,
    nextToken: stripFinalToken(appLocalStates.length, limit, response.nextToken),
  }
}
