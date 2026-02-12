/**
 * Shared helper functions for transaction tools
 */

import algosdk, { ABIMethod, OnApplicationComplete } from 'algosdk'
import { microAlgo } from '@algorandfoundation/algokit-utils'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { readFile } from 'node:fs/promises'
import { validateMetadataHash } from '../../lib/validators.js'
import type { McpConfig } from '../../config.js'

/** Type for the transaction composer returned by algorand.newGroup() */
type TransactionComposer = ReturnType<AlgorandClient['newGroup']>
import type {
  TxnSpec,
  TxnArg,
  BaseTxnSpec,
  PaymentTxnSpec,
  AssetTransferTxnSpec,
  AssetOptInTxnSpec,
  AssetOptOutTxnSpec,
  AssetCreateTxnSpec,
  AssetConfigTxnSpec,
  AssetFreezeTxnSpec,
  AssetDestroyTxnSpec,
  AppCallTxnSpec,
  AppOptInTxnSpec,
  AppCloseOutTxnSpec,
  AppDeleteTxnSpec,
} from './types.js'

/**
 * Resolve app spec from inline string or file path
 */
export async function resolveAppSpec(
  appSpec?: string,
  appSpecPath?: string
): Promise<string | undefined> {
  if (appSpecPath) {
    return readFile(appSpecPath, 'utf-8')
  }
  return appSpec
}

/**
 * Check if an argument is a transaction object (for ABI method call args)
 */
export function isTransactionArg(arg: unknown): arg is TxnArg {
  return (
    typeof arg === 'object' &&
    arg !== null &&
    'type' in arg &&
    ['pay', 'axfer', 'acfg', 'afrz'].includes((arg as TxnArg).type)
  )
}

/**
 * Build a transaction from a transaction argument object
 * Used for ABI method calls where a transaction is expected as an argument
 */
export async function buildTransactionArg(
  algorand: AlgorandClient,
  arg: TxnArg,
  defaultSender: string
): Promise<algosdk.Transaction> {
  const sender = arg.sender || defaultSender
  const note = arg.note ? new TextEncoder().encode(arg.note) : undefined

  switch (arg.type) {
    case 'pay': {
      return algorand.createTransaction.payment({
        sender,
        receiver: arg.receiver,
        amount: microAlgo(BigInt(arg.amount)),
        note,
      })
    }
    case 'axfer': {
      return algorand.createTransaction.assetTransfer({
        sender,
        assetId: BigInt(arg.assetId),
        receiver: arg.receiver,
        amount: BigInt(arg.amount),
        note,
      })
    }
    case 'acfg': {
      if (arg.assetId) {
        return algorand.createTransaction.assetConfig({
          sender,
          assetId: BigInt(arg.assetId),
          manager: arg.manager,
          reserve: arg.reserve,
          freeze: arg.freeze,
          clawback: arg.clawback,
          note,
        })
      } else {
        return algorand.createTransaction.assetCreate({
          sender,
          total: BigInt(arg.total ?? 0),
          decimals: arg.decimals ?? 0,
          assetName: arg.assetName,
          unitName: arg.unitName,
          url: arg.url,
          defaultFrozen: arg.defaultFrozen ?? false,
          manager: arg.manager,
          reserve: arg.reserve,
          freeze: arg.freeze,
          clawback: arg.clawback,
          note,
        })
      }
    }
    case 'afrz': {
      return algorand.createTransaction.assetFreeze({
        sender,
        assetId: BigInt(arg.assetId),
        account: arg.freezeTarget,
        frozen: arg.frozen,
        note,
      })
    }
    default: {
      const _exhaustive: never = arg
      throw new Error(`Unknown transaction arg type: ${(_exhaustive as TxnArg).type}`)
    }
  }
}

/**
 * Process method arguments, converting transaction objects to Transaction instances
 */
export async function processMethodArgs(
  algorand: AlgorandClient,
  args: unknown[],
  defaultSender: string
): Promise<unknown[]> {
  const processedArgs: unknown[] = []
  for (const arg of args) {
    if (isTransactionArg(arg)) {
      const txn = await buildTransactionArg(algorand, arg, defaultSender)
      processedArgs.push(txn)
    } else {
      processedArgs.push(arg)
    }
  }
  return processedArgs
}

/**
 * Build a transaction group from transaction specifications
 * Adds transactions to the composer and returns metadata about method calls
 */
export async function buildTransactionGroup(
  algorand: AlgorandClient,
  composer: TransactionComposer,
  transactions: TxnSpec[],
  getSender: (sender?: string) => string
): Promise<Array<{ index: number; hasReturn: boolean }>> {
  const methodReturns: Array<{ index: number; hasReturn: boolean }> = []

  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i]
    const sender = getSender(txn.sender)
    const note = txn.note ? new TextEncoder().encode(txn.note) : undefined

    switch (txn.type) {
      case 'payment': {
        const spec = txn as PaymentTxnSpec
        if (!spec.receiver) throw new Error(`Transaction ${i}: receiver is required for payment`)
        if (spec.amount === undefined)
          throw new Error(`Transaction ${i}: amount is required for payment`)
        composer.addPayment({
          sender,
          receiver: spec.receiver,
          amount: microAlgo(BigInt(spec.amount)),
          closeRemainderTo: spec.closeRemainderTo,
          note,
        })
        break
      }

      case 'asset_transfer': {
        const spec = txn as AssetTransferTxnSpec
        if (!spec.assetId)
          throw new Error(`Transaction ${i}: assetId is required for asset_transfer`)
        if (!spec.receiver)
          throw new Error(`Transaction ${i}: receiver is required for asset_transfer`)
        if (spec.amount === undefined)
          throw new Error(`Transaction ${i}: amount is required for asset_transfer`)
        composer.addAssetTransfer({
          sender,
          assetId: BigInt(spec.assetId),
          receiver: spec.receiver,
          amount: BigInt(spec.amount),
          clawbackTarget: spec.clawbackTarget,
          closeAssetTo: spec.closeAssetTo,
          note,
        })
        break
      }

      case 'asset_opt_in': {
        const spec = txn as AssetOptInTxnSpec
        if (!spec.assetId) throw new Error(`Transaction ${i}: assetId is required for asset_opt_in`)
        composer.addAssetOptIn({
          sender,
          assetId: BigInt(spec.assetId),
          note,
        })
        break
      }

      case 'asset_opt_out': {
        const spec = txn as AssetOptOutTxnSpec
        if (!spec.assetId)
          throw new Error(`Transaction ${i}: assetId is required for asset_opt_out`)
        if (!spec.closeAssetTo)
          throw new Error(`Transaction ${i}: closeAssetTo is required for asset_opt_out`)
        // Note: ensureZeroBalance is handled by wrapper tools before calling sendTransactions,
        // as the composer API doesn't support it directly
        composer.addAssetOptOut({
          sender,
          assetId: BigInt(spec.assetId),
          creator: spec.closeAssetTo,
          note,
        })
        break
      }

      case 'asset_create': {
        const spec = txn as AssetCreateTxnSpec
        if (spec.total === undefined)
          throw new Error(`Transaction ${i}: total is required for asset_create`)
        const metadataHashBytes = validateMetadataHash(spec.metadataHash)
        composer.addAssetCreate({
          sender,
          total: BigInt(spec.total),
          decimals: spec.decimals ?? 0,
          assetName: spec.assetName,
          unitName: spec.unitName,
          url: spec.url,
          metadataHash: metadataHashBytes,
          defaultFrozen: spec.defaultFrozen ?? false,
          manager: spec.manager,
          reserve: spec.reserve,
          freeze: spec.freeze,
          clawback: spec.clawback,
          note,
        })
        break
      }

      case 'asset_config': {
        const spec = txn as AssetConfigTxnSpec
        if (!spec.assetId) throw new Error(`Transaction ${i}: assetId is required for asset_config`)
        composer.addAssetConfig({
          sender,
          assetId: BigInt(spec.assetId),
          manager: spec.manager,
          reserve: spec.reserve,
          freeze: spec.freeze,
          clawback: spec.clawback,
          note,
        })
        break
      }

      case 'asset_freeze': {
        const spec = txn as AssetFreezeTxnSpec
        if (!spec.assetId) throw new Error(`Transaction ${i}: assetId is required for asset_freeze`)
        if (!spec.freezeTarget)
          throw new Error(`Transaction ${i}: freezeTarget is required for asset_freeze`)
        if (spec.frozen === undefined)
          throw new Error(`Transaction ${i}: frozen is required for asset_freeze`)
        composer.addAssetFreeze({
          sender,
          assetId: BigInt(spec.assetId),
          account: spec.freezeTarget,
          frozen: spec.frozen,
          note,
        })
        break
      }

      case 'asset_destroy': {
        const spec = txn as AssetDestroyTxnSpec
        if (!spec.assetId)
          throw new Error(`Transaction ${i}: assetId is required for asset_destroy`)
        composer.addAssetDestroy({
          sender,
          assetId: BigInt(spec.assetId),
          note,
        })
        break
      }

      case 'app_call':
      case 'app_opt_in':
      case 'app_close_out':
      case 'app_delete': {
        const spec = txn as AppCallTxnSpec | AppOptInTxnSpec | AppCloseOutTxnSpec | AppDeleteTxnSpec
        if (!spec.appId) throw new Error(`Transaction ${i}: appId is required for ${txn.type}`)

        let onComplete: OnApplicationComplete
        switch (txn.type) {
          case 'app_opt_in':
            onComplete = OnApplicationComplete.OptInOC
            break
          case 'app_close_out':
            onComplete = OnApplicationComplete.CloseOutOC
            break
          case 'app_delete':
            onComplete = OnApplicationComplete.DeleteApplicationOC
            break
          default:
            onComplete = OnApplicationComplete.NoOpOC
        }

        const resolvedAppSpec = await resolveAppSpec(spec.appSpec, spec.appSpecPath)
        const hasMethod = spec.methodSignature || (resolvedAppSpec && spec.method)

        if (hasMethod) {
          const processedArgs = await processMethodArgs(algorand, spec.args ?? [], sender)
          const extraFee = spec.extraFee ? microAlgo(BigInt(spec.extraFee)) : undefined
          const maxFee = spec.maxFee ? microAlgo(BigInt(spec.maxFee)) : undefined

          if (spec.methodSignature) {
            const abiMethod = ABIMethod.fromSignature(spec.methodSignature)
            composer.addAppCallMethodCall({
              sender,
              appId: BigInt(spec.appId),
              method: abiMethod,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              args: processedArgs as any,
              onComplete,
              note,
              extraFee,
              maxFee,
            })
            methodReturns.push({ index: i, hasReturn: true })
          } else if (resolvedAppSpec && spec.method) {
            const appSpecJson = JSON.parse(resolvedAppSpec)
            const methods = appSpecJson.contract?.methods || appSpecJson.methods || []
            const methodDef = methods.find((m: { name: string }) => m.name === spec.method)
            if (!methodDef) {
              throw new Error(`Transaction ${i}: method "${spec.method}" not found in app spec`)
            }
            const argTypes = (methodDef.args || []).map((a: { type: string }) => a.type).join(',')
            const returnType = methodDef.returns?.type || 'void'
            const methodSig = `${spec.method}(${argTypes})${returnType}`
            const abiMethod = ABIMethod.fromSignature(methodSig)
            composer.addAppCallMethodCall({
              sender,
              appId: BigInt(spec.appId),
              method: abiMethod,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              args: processedArgs as any,
              onComplete,
              note,
              extraFee,
              maxFee,
            })
            methodReturns.push({ index: i, hasReturn: true })
          }
        } else {
          const extraFee = spec.extraFee ? microAlgo(BigInt(spec.extraFee)) : undefined
          const maxFee = spec.maxFee ? microAlgo(BigInt(spec.maxFee)) : undefined
          composer.addAppCall({
            sender,
            appId: BigInt(spec.appId),
            onComplete,
            note,
            extraFee,
            maxFee,
          })
        }
        break
      }

      default:
        throw new Error(`Transaction ${i}: unknown type "${(txn as BaseTxnSpec).type}"`)
    }
  }

  return methodReturns
}

/** Result from sendTransactions() */
export interface SendTransactionsResult {
  groupId: string
  txIds: string[]
  confirmedRound?: number
  returns?: unknown[]
  /** Asset ID from asset_create transaction (first one if multiple) */
  assetId?: bigint
  network: string
}

/** Internal arguments for sendTransactions() */
export interface SendTransactionsArgs {
  transactions: TxnSpec[]
  populateAppCallResources?: boolean
  coverAppCallInnerTransactionFees?: boolean
}

/**
 * Internal function to send transactions.
 * All wrapper tools call this to execute their transactions.
 */
export async function sendTransactions(
  args: SendTransactionsArgs,
  algorand: AlgorandClient,
  config: McpConfig,
  resolveSenderFn: (
    algorand: AlgorandClient,
    config: McpConfig,
    sender?: string
  ) => Promise<{ address: string }>
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
    const { address } = await resolveSenderFn(algorand, config, sender)
    senderAddresses.set(sender, address)
  }

  const getSender = (sender?: string): string => {
    return senderAddresses.get(sender)!
  }

  // Build the transaction group
  const composer = algorand.newGroup()
  await buildTransactionGroup(algorand, composer, transactions, getSender)

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
    network: config.network,
  }
}

/** Execution tracing configuration */
export interface ExecTraceConfig {
  enable?: boolean
  scratchChange?: boolean
  stackChange?: boolean
  stateChange?: boolean
}

/** Internal arguments for simulateTransactions() */
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
  network: string
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
 * Internal function to simulate transactions.
 * Previews execution without broadcasting.
 */
export async function simulateTransactions(
  args: SimulateTransactionsArgs,
  algorand: AlgorandClient,
  config: McpConfig,
  resolveSenderFn: (
    algorand: AlgorandClient,
    config: McpConfig,
    sender?: string
  ) => Promise<{ address: string }>
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
    const { address } = await resolveSenderFn(algorand, config, sender)
    senderAddresses.set(sender, address)
  }

  const getSender = (sender?: string): string => {
    return senderAddresses.get(sender)!
  }

  // Build the transaction group
  const composer = algorand.newGroup()
  await buildTransactionGroup(algorand, composer, transactions, getSender)

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
    network: config.network,
  }
}
