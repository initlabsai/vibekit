/**
 * Transaction simulation logic
 */

import algosdk from 'algosdk'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { buildTransactionGroup } from './build'
import type { TxnSpec, ResolveAppSpecFn } from './types'
import type { ResolveSenderFn } from './send'

/** Execution tracing configuration */
export interface ExecTraceConfig {
  enable?: boolean
  scratchChange?: boolean
  stackChange?: boolean
  stateChange?: boolean
}

/** Arguments for simulateTransactions() */
export interface SimulateTransactionsArgs {
  transactions: TxnSpec[]
  allowMoreLogging?: boolean
  allowUnnamedResources?: boolean
  extraOpcodeBudget?: number
  execTraceConfig?: ExecTraceConfig
}

/** Per-transaction simulation result */
export interface TransactionSimulationResult {
  txId: string
  logs?: string[]
  globalStateDelta?: Record<string, { action: string; value?: unknown }>
  localStateDelta?: Array<{ address: string; delta: Record<string, unknown> }>
  budgetConsumed?: number
}

/** Result from simulateTransactions() */
export interface SimulateTransactionsResult {
  wouldSucceed: boolean
  failureMessage?: string
  simulatedRound: number
  groupId: string
  txIds: string[]
  transactionResults: TransactionSimulationResult[]
  returns?: unknown[]
  trace?: unknown
  appBudgetConsumed?: number
  appBudgetAdded?: number
}

/**
 * Decode base64-encoded log bytes to readable strings where possible
 */
function decodeLogs(logs: Uint8Array[]): string[] {
  return logs.map((log) => {
    try {
      const decoded = new TextDecoder().decode(log)
      if (/^[\x20-\x7E\n\r\t]*$/.test(decoded)) {
        return decoded
      }
      return '0x' + Buffer.from(log).toString('hex')
    } catch {
      return '0x' + Buffer.from(log).toString('hex')
    }
  })
}

/**
 * Parse state delta from simulation response
 */
function parseStateDelta(
  delta: algosdk.modelsv2.EvalDeltaKeyValue[] | undefined
): Record<string, { action: string; value?: unknown }> | undefined {
  if (!delta || delta.length === 0) return undefined

  const result: Record<string, { action: string; value?: unknown }> = {}
  for (const kv of delta) {
    const key = kv.key ? Buffer.from(kv.key).toString('base64') : 'unknown'
    const valueDelta = kv.value
    if (valueDelta) {
      const action =
        valueDelta.action === 1 ? 'set_bytes' : valueDelta.action === 2 ? 'set_uint' : 'delete'
      result[key] = {
        action,
        value:
          valueDelta.action === 1
            ? valueDelta.bytes
            : valueDelta.action === 2
              ? Number(valueDelta.uint)
              : undefined,
      }
    }
  }
  return result
}

/**
 * Parse local state delta from simulation response
 */
function parseLocalStateDelta(
  delta: algosdk.modelsv2.AccountStateDelta[] | undefined
): Array<{ address: string; delta: Record<string, unknown> }> | undefined {
  if (!delta || delta.length === 0) return undefined

  return delta.map((accountDelta) => ({
    address: accountDelta.address,
    delta: parseStateDelta(accountDelta.delta) || {},
  }))
}

/**
 * Simulate transactions without broadcasting.
 * Previews execution results including state changes and costs.
 */
export async function simulateTransactions(
  args: SimulateTransactionsArgs,
  algorand: AlgorandClient,
  resolveSenderFn: ResolveSenderFn,
  resolveAppSpecFn?: ResolveAppSpecFn
): Promise<SimulateTransactionsResult> {
  const {
    transactions,
    allowMoreLogging = false,
    allowUnnamedResources = true,
    extraOpcodeBudget,
    execTraceConfig,
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

  // Simulate the group
  const simulateResult = await composer.simulate({
    skipSignatures: true,
    allowMoreLogging,
    allowUnnamedResources,
    extraOpcodeBudget,
    execTraceConfig: execTraceConfig?.enable
      ? new algosdk.modelsv2.SimulateTraceConfig({
          enable: true,
          scratchChange: execTraceConfig.scratchChange,
          stackChange: execTraceConfig.stackChange,
          stateChange: execTraceConfig.stateChange,
        })
      : undefined,
  })

  const simulateResponse = simulateResult.simulateResponse
  const txnGroups = simulateResponse.txnGroups

  let wouldSucceed = true
  let failureMessage: string | undefined

  if (txnGroups && txnGroups.length > 0) {
    const group = txnGroups[0]
    if (group.failureMessage) {
      wouldSucceed = false
      failureMessage = group.failureMessage
    }
    if (group.txnResults) {
      for (const txnResult of group.txnResults) {
        if (txnResult.txnResult?.poolError) {
          wouldSucceed = false
          failureMessage = failureMessage || txnResult.txnResult.poolError
        }
      }
    }
  }

  const transactionResults: TransactionSimulationResult[] = []
  const txnResults = txnGroups?.[0]?.txnResults || []

  for (let i = 0; i < simulateResult.txIds.length; i++) {
    const txnResult = txnResults[i]?.txnResult
    const result: TransactionSimulationResult = {
      txId: simulateResult.txIds[i],
    }

    if (txnResult) {
      if (txnResult.logs && txnResult.logs.length > 0) {
        result.logs = decodeLogs(txnResult.logs)
      }

      result.globalStateDelta = parseStateDelta(txnResult.globalStateDelta)
      result.localStateDelta = parseLocalStateDelta(txnResult.localStateDelta)
    }

    const appBudgetConsumed = txnResults[i]?.appBudgetConsumed
    if (appBudgetConsumed !== undefined) {
      result.budgetConsumed = Number(appBudgetConsumed)
    }

    transactionResults.push(result)
  }

  const groupAppBudgetConsumed = txnGroups?.[0]?.appBudgetConsumed
  const groupAppBudgetAdded = txnGroups?.[0]?.appBudgetAdded

  const returns: unknown[] = []
  if (simulateResult.returns && simulateResult.returns.length > 0) {
    for (const ret of simulateResult.returns) {
      returns.push(ret.returnValue)
    }
  }

  let trace: unknown
  if (execTraceConfig?.enable && txnGroups?.[0]?.txnResults) {
    trace = txnGroups[0].txnResults.map((tr) => tr.execTrace)
  }

  return {
    wouldSucceed,
    failureMessage,
    simulatedRound: Number(simulateResponse.lastRound),
    groupId: simulateResult.groupId,
    txIds: simulateResult.txIds,
    transactionResults,
    returns: returns.length > 0 ? returns : undefined,
    trace,
    appBudgetConsumed:
      groupAppBudgetConsumed !== undefined ? Number(groupAppBudgetConsumed) : undefined,
    appBudgetAdded: groupAppBudgetAdded !== undefined ? Number(groupAppBudgetAdded) : undefined,
  }
}
