import { DEFAULT_LIMIT, ToolError, stripFinalToken, type ToolContext } from '@initlabs/vibekit-core'
import algosdk from 'algosdk'
import { formatTransaction, type FormattedTransaction } from '../../shared/format.js'
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
  ctx: ToolContext,
  args: SearchAccountTransactionsArgs,
): Promise<{ transactions: FormattedTransaction[]; nextToken?: string }> {
  if (!algosdk.isValidAddress(args.address)) {
    throw new ToolError('INVALID_ADDRESS', `Invalid Algorand address: ${args.address}`)
  }
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = ctx.indexer.searchForTransactions().address(args.address).limit(limit)

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
