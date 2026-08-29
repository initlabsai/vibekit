import { DEFAULT_LIMIT, ToolError, stripFinalToken, type ToolContext } from '../../core/index.js'
import algosdk from 'algosdk'
import { enrichAssetParams } from '../shared/asset-params.js'
import { formatTransaction, type FormattedTransaction } from '../shared/format.js'
import { transactionQueryOf, type TransactionQuery } from '../shared/schemas.js'
import { formatAccount, type FormattedAccount } from './format.js'

export interface SearchAccountsArgs {
  limit?: number
  nextToken?: string
  assetId?: number
  applicationId?: number
  currencyGreaterThan?: number
  currencyLessThan?: number
}

export async function searchAccounts(
  ctx: ToolContext,
  args: SearchAccountsArgs,
): Promise<{ accounts: FormattedAccount[]; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = ctx.indexer.searchAccounts().limit(limit)

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

export interface SearchAccountTransactionsArgs {
  address: string
  /** Only transactions where the address played this part; unset means either. */
  addressRole?: 'sender' | 'receiver'
  limit?: number
  nextToken?: string
  assetId?: number
  txType?: string
  minRound?: number
  maxRound?: number
  beforeTime?: string
  afterTime?: string
  minAmount?: number
  maxAmount?: number
  notePrefix?: string
}

export async function searchAccountTransactions(
  ctx: ToolContext,
  args: SearchAccountTransactionsArgs,
): Promise<{ transactions: FormattedTransaction[]; nextToken?: string; query?: TransactionQuery }> {
  if (!algosdk.isValidAddress(args.address)) {
    throw new ToolError('INVALID_ADDRESS', `Invalid Algorand address: ${args.address}`)
  }
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = ctx.indexer.searchForTransactions().address(args.address).limit(limit)

  if (args.addressRole) query = query.addressRole(args.addressRole)
  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.assetId) query = query.assetID(args.assetId)
  if (args.txType) query = query.txType(args.txType)
  if (args.minRound) query = query.minRound(args.minRound)
  if (args.maxRound) query = query.maxRound(args.maxRound)
  if (args.beforeTime) query = query.beforeTime(args.beforeTime)
  if (args.afterTime) query = query.afterTime(args.afterTime)
  if (args.minAmount) query = query.currencyGreaterThan(args.minAmount - 1)
  if (args.maxAmount !== undefined) query = query.currencyLessThan(args.maxAmount + 1)
  if (args.notePrefix) query = query.notePrefix(new TextEncoder().encode(args.notePrefix))

  const response = await query.do()
  const transactions = (response.transactions ?? []).map(formatTransaction)
  await enrichAssetParams(ctx, transactions)
  return {
    transactions,
    nextToken: stripFinalToken(transactions.length, limit, response.nextToken),
    query: transactionQueryOf(args),
  }
}
