/**
 * The compose engine: TxnSpec[] → AtomicTransactionComposer, on raw algosdk.
 * One path for plain transactions and ABI method calls, in both modes:
 * execute (real signers via ctx.resolveSigner) and compose/simulate (empty signers).
 */
import algosdk, { ABIMethod, AtomicTransactionComposer, OnApplicationComplete } from 'algosdk'
import { ToolError } from '../errors.js'
import { validateMetadataHash } from '../util.js'
import type { ToolContext } from '../contract.js'
import type { TxnArg, TxnSpec } from './types.js'

export interface BuiltGroup {
  atc: AtomicTransactionComposer
  /** Spec indexes that are ABI method calls (have decodable returns). */
  methodIndexes: number[]
}

/** Resource references attached to one app-call transaction. */
export interface GroupResources {
  boxes?: algosdk.BoxReference[]
  accounts?: string[]
  foreignApps?: number[]
  foreignAssets?: number[]
}

function encodeNote(note?: string): Uint8Array | undefined {
  return note ? new TextEncoder().encode(note) : undefined
}

function requireAddress(value: string | undefined, what: string, index: number): string {
  if (!value || !algosdk.isValidAddress(value)) {
    throw new ToolError(
      'INVALID_ADDRESS',
      `Transaction ${index}: ${what} must be a valid address (got: ${value})`,
    )
  }
  return value
}

/** Validate an address field only when present. */
function optionalAddress(
  value: string | undefined,
  what: string,
  index: number,
): string | undefined {
  if (value === undefined) return undefined
  return requireAddress(value, what, index)
}

/** Account/position-closing fields empty the source — demand explicit intent. */
function requireCloseConfirmation(
  closeTo: string | undefined,
  confirmed: boolean | undefined,
  what: string,
  index: number,
): void {
  if (closeTo !== undefined && confirmed !== true) {
    throw new ToolError(
      'CLOSE_NOT_CONFIRMED',
      `Transaction ${index}: ${what} closes the position and sends the ENTIRE remaining balance — set confirmCloseAccount: true to proceed`,
    )
  }
}

/** Per-spec suggested params honoring extraFee/maxFee via flat fees. */
function feeParams(
  base: algosdk.SuggestedParams,
  extraFee?: number,
  maxFee?: number,
): algosdk.SuggestedParams {
  if (extraFee === undefined && maxFee === undefined) return base
  let fee = BigInt(base.minFee) + BigInt(extraFee ?? 0)
  if (maxFee !== undefined && fee > BigInt(maxFee)) fee = BigInt(maxFee)
  return { ...base, flatFee: true, fee }
}

function isTransactionArg(arg: unknown): arg is TxnArg {
  return (
    typeof arg === 'object' &&
    arg !== null &&
    'type' in arg &&
    ['pay', 'axfer', 'acfg', 'afrz'].includes((arg as TxnArg).type)
  )
}

function buildTransactionArg(
  arg: TxnArg,
  defaultSender: string,
  suggestedParams: algosdk.SuggestedParams,
  index = 0,
): algosdk.Transaction {
  const sender = requireAddress(arg.sender ?? defaultSender, 'sender', index)
  const note = encodeNote(arg.note)

  switch (arg.type) {
    case 'pay':
      return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender,
        receiver: requireAddress(arg.receiver, 'receiver', index),
        amount: BigInt(arg.amount ?? 0),
        note,
        suggestedParams,
      })
    case 'axfer':
      return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender,
        receiver: requireAddress(arg.receiver, 'receiver', index),
        assetIndex: BigInt(arg.assetId ?? 0),
        amount: BigInt(arg.amount ?? 0),
        note,
        suggestedParams,
      })
    case 'acfg':
      if (arg.assetId) {
        // Same guard as the top-level asset_config: omitted roles clear
        // PERMANENTLY, so keep strict checking unless confirmClearRoles is set.
        // (An acfg embedded in an ABI arg must not be a silent-clear bypass.)
        return algosdk.makeAssetConfigTxnWithSuggestedParamsFromObject({
          sender,
          assetIndex: BigInt(arg.assetId),
          manager: optionalAddress(arg.manager, 'manager', index),
          reserve: optionalAddress(arg.reserve, 'reserve', index),
          freeze: optionalAddress(arg.freeze, 'freeze', index),
          clawback: optionalAddress(arg.clawback, 'clawback', index),
          strictEmptyAddressChecking: arg.confirmClearRoles !== true,
          note,
          suggestedParams,
        })
      }
      return algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        sender,
        total: BigInt(arg.total ?? 0),
        decimals: arg.decimals ?? 0,
        assetName: arg.assetName,
        unitName: arg.unitName,
        assetURL: arg.url,
        defaultFrozen: arg.defaultFrozen ?? false,
        manager: optionalAddress(arg.manager, 'manager', index),
        reserve: optionalAddress(arg.reserve, 'reserve', index),
        freeze: optionalAddress(arg.freeze, 'freeze', index),
        clawback: optionalAddress(arg.clawback, 'clawback', index),
        note,
        suggestedParams,
      })
    case 'afrz':
      return algosdk.makeAssetFreezeTxnWithSuggestedParamsFromObject({
        sender,
        assetIndex: BigInt(arg.assetId ?? 0),
        freezeTarget: requireAddress(arg.freezeTarget, 'freezeTarget', index),
        frozen: arg.frozen ?? false,
        note,
        suggestedParams,
      })
  }
}

/** Resolve an ABIMethod from a signature or an app spec + method name. */
export function resolveAbiMethod(
  spec: { methodSignature?: string; appSpec?: string; method?: string },
  index: number,
): ABIMethod | undefined {
  if (spec.methodSignature) {
    return ABIMethod.fromSignature(spec.methodSignature)
  }
  if (spec.appSpec && spec.method) {
    let parsed: { contract?: { methods?: unknown[] }; methods?: unknown[] }
    try {
      parsed = JSON.parse(spec.appSpec)
    } catch {
      throw new ToolError('INVALID_APP_SPEC', `Transaction ${index}: appSpec is not valid JSON`)
    }
    const methods = (parsed.contract?.methods ?? parsed.methods ?? []) as Array<{
      name: string
      args?: Array<{ type: string }>
      returns?: { type: string }
    }>
    const methodDef = methods.find((m) => m.name === spec.method)
    if (!methodDef) {
      throw new ToolError(
        'METHOD_NOT_FOUND',
        `Transaction ${index}: method "${spec.method}" not found in app spec`,
      )
    }
    const argTypes = (methodDef.args ?? []).map((a) => a.type).join(',')
    const returnType = methodDef.returns?.type ?? 'void'
    return ABIMethod.fromSignature(`${spec.method}(${argTypes})${returnType}`)
  }
  return undefined
}

/**
 * Build an AtomicTransactionComposer from specs. In execute mode signers come
 * from ctx.resolveSigner (cached per sender); otherwise empty signers are used
 * (compose returns unsigned txns; simulate allows empty signatures).
 */
export async function buildGroup(
  ctx: ToolContext,
  specs: TxnSpec[],
  resourcesByIndex?: ReadonlyMap<number, GroupResources>,
): Promise<BuiltGroup> {
  if (specs.length === 0 || specs.length > 16) {
    throw new ToolError(
      'INVALID_GROUP',
      `Transaction group must have 1-16 transactions (got ${specs.length})`,
    )
  }

  const suggestedParams = await ctx.algod.getTransactionParams().do()
  const atc = new AtomicTransactionComposer()
  const methodIndexes: number[] = []

  const signerCache = new Map<string, algosdk.TransactionSigner>()
  const emptySigner = algosdk.makeEmptyTransactionSigner()
  const signerFor = async (sender: string): Promise<algosdk.TransactionSigner> => {
    if (ctx.mode !== 'execute') return emptySigner
    if (!ctx.resolveSigner) {
      throw new ToolError(
        'NO_SIGNER',
        'This deployment has no signer configured; use compose mode.',
      )
    }
    const cached = signerCache.get(sender)
    if (cached) return cached
    const signer = await ctx.resolveSigner(sender)
    signerCache.set(sender, signer)
    return signer
  }

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]!
    const sender = requireAddress(spec.sender, 'sender', i)
    const note = encodeNote(spec.note)
    const signer = await signerFor(sender)

    switch (spec.type) {
      case 'payment': {
        requireAddress(spec.receiver, 'receiver', i)
        requireCloseConfirmation(
          spec.closeRemainderTo,
          spec.confirmCloseAccount,
          'closeRemainderTo',
          i,
        )
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender,
          receiver: spec.receiver,
          amount: BigInt(spec.amountMicroAlgos),
          closeRemainderTo: optionalAddress(spec.closeRemainderTo, 'closeRemainderTo', i),
          note,
          suggestedParams,
        })
        atc.addTransaction({ txn, signer })
        break
      }

      case 'asset_transfer': {
        requireAddress(spec.receiver, 'receiver', i)
        requireCloseConfirmation(spec.closeAssetTo, spec.confirmCloseAccount, 'closeAssetTo', i)
        const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender,
          receiver: spec.receiver,
          assetIndex: BigInt(spec.assetId),
          amount: BigInt(spec.amount),
          assetSender: optionalAddress(spec.clawbackTarget, 'clawbackTarget', i),
          closeRemainderTo: optionalAddress(spec.closeAssetTo, 'closeAssetTo', i),
          note,
          suggestedParams,
        })
        atc.addTransaction({ txn, signer })
        break
      }

      case 'asset_opt_in': {
        const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender,
          receiver: sender,
          assetIndex: BigInt(spec.assetId),
          amount: BigInt(0),
          note,
          suggestedParams,
        })
        atc.addTransaction({ txn, signer })
        break
      }

      case 'asset_opt_out': {
        requireAddress(spec.closeAssetTo, 'closeAssetTo', i)
        if (spec.ensureZeroBalance !== false) {
          const info = await ctx.algod.accountAssetInformation(sender, BigInt(spec.assetId)).do()
          const held = info.assetHolding?.amount ?? BigInt(0)
          if (held !== BigInt(0)) {
            throw new ToolError(
              'NONZERO_BALANCE',
              `Transaction ${i}: account holds ${held} of asset ${spec.assetId}; opting out would forfeit it (set ensureZeroBalance: false to override)`,
            )
          }
        }
        const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender,
          receiver: spec.closeAssetTo,
          assetIndex: BigInt(spec.assetId),
          amount: BigInt(0),
          closeRemainderTo: spec.closeAssetTo,
          note,
          suggestedParams,
        })
        atc.addTransaction({ txn, signer })
        break
      }

      case 'asset_create': {
        const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
          sender,
          total: BigInt(spec.total),
          decimals: spec.decimals ?? 0,
          assetName: spec.assetName,
          unitName: spec.unitName,
          assetURL: spec.url,
          assetMetadataHash: validateMetadataHash(spec.metadataHash),
          defaultFrozen: spec.defaultFrozen ?? false,
          manager: optionalAddress(spec.manager, 'manager', i),
          reserve: optionalAddress(spec.reserve, 'reserve', i),
          freeze: optionalAddress(spec.freeze, 'freeze', i),
          clawback: optionalAddress(spec.clawback, 'clawback', i),
          note,
          suggestedParams,
        })
        atc.addTransaction({ txn, signer })
        break
      }

      case 'asset_config': {
        const txn = algosdk.makeAssetConfigTxnWithSuggestedParamsFromObject({
          sender,
          assetIndex: BigInt(spec.assetId),
          manager: optionalAddress(spec.manager, 'manager', i),
          reserve: optionalAddress(spec.reserve, 'reserve', i),
          freeze: optionalAddress(spec.freeze, 'freeze', i),
          clawback: optionalAddress(spec.clawback, 'clawback', i),
          // Omitted roles are cleared PERMANENTLY — demand explicit intent.
          strictEmptyAddressChecking: spec.confirmClearRoles !== true,
          note,
          suggestedParams,
        })
        atc.addTransaction({ txn, signer })
        break
      }

      case 'asset_freeze': {
        requireAddress(spec.freezeTarget, 'freezeTarget', i)
        const txn = algosdk.makeAssetFreezeTxnWithSuggestedParamsFromObject({
          sender,
          assetIndex: BigInt(spec.assetId),
          freezeTarget: spec.freezeTarget,
          frozen: spec.frozen,
          note,
          suggestedParams,
        })
        atc.addTransaction({ txn, signer })
        break
      }

      case 'asset_destroy': {
        const txn = algosdk.makeAssetDestroyTxnWithSuggestedParamsFromObject({
          sender,
          assetIndex: BigInt(spec.assetId),
          note,
          suggestedParams,
        })
        atc.addTransaction({ txn, signer })
        break
      }

      case 'app_call':
      case 'app_opt_in':
      case 'app_close_out':
      case 'app_delete': {
        const onComplete =
          spec.type === 'app_opt_in'
            ? OnApplicationComplete.OptInOC
            : spec.type === 'app_close_out'
              ? OnApplicationComplete.CloseOutOC
              : spec.type === 'app_delete'
                ? OnApplicationComplete.DeleteApplicationOC
                : OnApplicationComplete.NoOpOC

        const abiMethod = resolveAbiMethod(spec, i)
        const params = feeParams(suggestedParams, spec.extraFee, spec.maxFee)

        if (abiMethod) {
          const methodArgs = (spec.args ?? []).map((arg) =>
            isTransactionArg(arg)
              ? { txn: buildTransactionArg(arg, sender, suggestedParams, i), signer }
              : arg,
          )
          const resources = resourcesByIndex?.get(i)
          atc.addMethodCall({
            appID: BigInt(spec.appId),
            method: abiMethod,
            methodArgs: methodArgs as algosdk.ABIArgument[],
            sender,
            signer,
            onComplete,
            note,
            suggestedParams: params,
            ...(resources?.boxes ? { boxes: resources.boxes } : {}),
            ...(resources?.accounts ? { appAccounts: resources.accounts } : {}),
            ...(resources?.foreignApps ? { appForeignApps: resources.foreignApps } : {}),
            ...(resources?.foreignAssets ? { appForeignAssets: resources.foreignAssets } : {}),
          })
          methodIndexes.push(i)
        } else {
          const resources = resourcesByIndex?.get(i)
          const txn = algosdk.makeApplicationCallTxnFromObject({
            sender,
            appIndex: BigInt(spec.appId),
            onComplete,
            note,
            suggestedParams: params,
            ...(resources?.boxes ? { boxes: resources.boxes } : {}),
            ...(resources?.accounts ? { accounts: resources.accounts } : {}),
            ...(resources?.foreignApps ? { foreignApps: resources.foreignApps } : {}),
            ...(resources?.foreignAssets ? { foreignAssets: resources.foreignAssets } : {}),
          })
          atc.addTransaction({ txn, signer })
        }
        break
      }

      default:
        throw new ToolError(
          'UNKNOWN_TXN_TYPE',
          `Transaction ${i}: unknown type "${(spec as TxnSpec).type}"`,
        )
    }
  }

  return { atc, methodIndexes }
}
