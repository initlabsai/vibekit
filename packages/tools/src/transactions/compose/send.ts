/**
 * Transaction sending logic
 */

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { buildTransactionGroup } from './build'
import type { TxnSpec, ResolveAppSpecFn } from './types'

/** Function to resolve the sender account for signing */
export type ResolveSenderFn = (
  algorand: AlgorandClient,
  sender?: string
) => Promise<{ address: string }>

/** Arguments for sendTransactions() */
export interface SendTransactionsArgs {
  transactions: TxnSpec[]
  populateAppCallResources?: boolean
  coverAppCallInnerTransactionFees?: boolean
}

/** Result from sendTransactions() */
export interface SendTransactionsResult {
  groupId: string
  txIds: string[]
  confirmedRound?: number
  returns?: unknown[]
  /** Asset ID from asset_create transaction (first one if multiple) */
  assetId?: bigint
}

/**
 * Send transactions as an atomic group.
 * All wrapper tools call this to execute their transactions.
 */
export async function sendTransactions(
  args: SendTransactionsArgs,
  algorand: AlgorandClient,
  resolveSenderFn: ResolveSenderFn,
  resolveAppSpecFn?: ResolveAppSpecFn
): Promise<SendTransactionsResult> {
  const {
    transactions,
    populateAppCallResources = true,
    coverAppCallInnerTransactionFees = false,
  } = args

  if (!transactions || transactions.length === 0) {
    throw new Error('At least one transaction is required')
  }

  if (transactions.length > 16) {
    throw new Error('Maximum 16 transactions per atomic group')
  }

  // Register signers for all unique senders
  const uniqueSenders = new Set<string | undefined>()
  for (const txn of transactions) {
    uniqueSenders.add(txn.sender)
  }

  const senderAddresses = new Map<string | undefined, string>()
  for (const sender of uniqueSenders) {
    const { address } = await resolveSenderFn(algorand, sender)
    senderAddresses.set(sender, address)
  }

  const getSender = (sender?: string): string => {
    return senderAddresses.get(sender)!
  }

  // Build the transaction group
  const composer = algorand.newGroup()
  await buildTransactionGroup(algorand, composer, transactions, getSender, resolveAppSpecFn)

  // Send the group
  const result = await composer.send({
    populateAppCallResources,
    coverAppCallInnerTransactionFees,
  })

  // Extract return values for ABI method calls
  const returns: unknown[] = []
  if (result.returns && result.returns.length > 0) {
    for (const ret of result.returns) {
      returns.push(ret.returnValue)
    }
  }

  // Extract asset ID for asset_create transactions
  let assetId: bigint | undefined
  if (result.confirmations) {
    for (const confirmation of result.confirmations) {
      if (confirmation.assetIndex) {
        assetId = confirmation.assetIndex
        break
      }
    }
  }

  return {
    groupId: result.groupId,
    txIds: result.txIds,
    confirmedRound: result.confirmations?.[0]?.confirmedRound
      ? Number(result.confirmations[0].confirmedRound)
      : undefined,
    returns: returns.length > 0 ? returns : undefined,
    assetId,
  }
}
