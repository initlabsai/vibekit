import {
  DEFAULT_LIMIT,
  ToolError,
  bytesToBase64,
  stripFinalToken,
  type ToolContext,
} from '@initlabs/core'
import algosdk from 'algosdk'
import { formatAccount, type FormattedAccount } from './format.js'

const MICROALGOS_PER_ALGO = 1_000_000

type IndexerTransaction = InstanceType<typeof import('algosdk').indexerModels.Transaction>

export interface FormattedTransaction {
  id: string
  type: string
  sender: string
  fee: number
  confirmedRound?: number
  roundTime?: number
  paymentAmount?: number
  receiver?: string
  assetId?: number
  assetName?: string
  assetUnitName?: string
  assetDecimals?: number
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
  if (tx.applicationTransaction) {
    formatted.applicationId = Number(tx.applicationTransaction.applicationId)
  }
  if (tx.note && tx.note.length > 0) {
    try {
      formatted.note = new TextDecoder().decode(tx.note)
    } catch {
      formatted.note = bytesToBase64(tx.note)
    }
  }
  if (tx.group) formatted.group = bytesToBase64(tx.group)
  if (tx.innerTxns && tx.innerTxns.length > 0)
    formatted.innerTxns = tx.innerTxns.map(formatTransaction)
  if (tx.globalStateDelta) formatted.globalStateDelta = tx.globalStateDelta
  if (tx.localStateDelta) formatted.localStateDelta = tx.localStateDelta
  if (tx.logs && tx.logs.length > 0) formatted.logs = tx.logs.map((l) => bytesToBase64(l))
  return formatted
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
