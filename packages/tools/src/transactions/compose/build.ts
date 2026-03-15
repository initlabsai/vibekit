/**
 * Transaction group building logic
 */

import algosdk, { ABIMethod, OnApplicationComplete } from 'algosdk'
import { microAlgo } from '@algorandfoundation/algokit-utils'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { validateMetadataHash } from '@vibekit/core'
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
  ResolveAppSpecFn,
} from './types'

/** Type for the transaction composer returned by algorand.newGroup() */
type TransactionComposer = ReturnType<AlgorandClient['newGroup']>

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
 * Build a transaction from a transaction argument object.
 * Used for ABI method calls where a transaction is expected as an argument.
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
 * Build a transaction group from transaction specifications.
 * Adds transactions to the composer and returns metadata about method calls.
 */
export async function buildTransactionGroup(
  algorand: AlgorandClient,
  composer: TransactionComposer,
  transactions: TxnSpec[],
  getSender: (sender?: string) => string,
  resolveAppSpecFn?: ResolveAppSpecFn
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

        const resolvedAppSpec = resolveAppSpecFn
          ? await resolveAppSpecFn(spec.appSpec, spec.appSpecPath)
          : spec.appSpec
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
