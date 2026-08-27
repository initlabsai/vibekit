/** Finish a built group: compose (unsigned txns out), execute (sign/send/confirm), or simulate. */
import algosdk from 'algosdk'
import { bytesToBase64 } from '../codec.js'
import type { ToolContext, UnsignedGroupResult } from '../contract.js'
import type { BuiltGroup } from './build.js'
import type { TxnSpec } from './types.js'

export interface ExecuteGroupResult {
  txids: string[]
  confirmedRound: number
  /** Decoded ABI return values, aligned with the spec indexes that were method calls. */
  returns: Array<{ index: number; value: unknown }>
}

export type ComposeOrExecuteResult = UnsignedGroupResult | ExecuteGroupResult

function describeSpec(spec: TxnSpec): string {
  switch (spec.type) {
    case 'payment':
      return (
        `pay ${spec.amountMicroAlgos} microALGO ${spec.sender} → ${spec.receiver}` +
        (spec.closeRemainderTo
          ? ` + CLOSE ACCOUNT (entire remaining balance → ${spec.closeRemainderTo})`
          : '')
      )
    case 'asset_transfer':
      return (
        `transfer ${spec.amount} of asset ${spec.assetId} ${spec.sender} → ${spec.receiver}` +
        (spec.closeAssetTo ? ` + CLOSE ASSET POSITION (remainder → ${spec.closeAssetTo})` : '')
      )
    case 'asset_opt_in':
      return `opt ${spec.sender} into asset ${spec.assetId}`
    case 'asset_opt_out':
      return `opt ${spec.sender} out of asset ${spec.assetId}`
    case 'asset_create':
      return `create asset "${spec.assetName ?? spec.unitName ?? 'unnamed'}" (total ${spec.total})`
    case 'asset_config':
      return (
        `reconfigure asset ${spec.assetId}` +
        (spec.confirmClearRoles ? ' (omitted roles CLEARED PERMANENTLY)' : '')
      )
    case 'asset_freeze':
      return `${spec.frozen ? 'freeze' : 'unfreeze'} asset ${spec.assetId} for ${spec.freezeTarget}`
    case 'asset_destroy':
      return `destroy asset ${spec.assetId}`
    case 'app_call':
    case 'app_opt_in':
    case 'app_close_out':
    case 'app_delete':
      return `${spec.type.replace('_', ' ')} app ${spec.appId}${(spec.method ?? spec.methodSignature) ? ` (${spec.method ?? spec.methodSignature})` : ''}`
  }
}

/**
 * Compose mode: return the unsigned group for external signing.
 * Execute mode: sign via the ATC's signers, submit, wait for confirmation.
 */
export async function finishGroup(
  ctx: ToolContext,
  built: BuiltGroup,
  specs: TxnSpec[],
): Promise<ComposeOrExecuteResult> {
  if (ctx.mode === 'compose') {
    const group = built.atc.buildGroup()
    return {
      unsignedGroup: group.map((t) => bytesToBase64(algosdk.encodeUnsignedTransaction(t.txn))),
      summary: specs.map((spec, i) => `[${i}] ${describeSpec(spec)}`).join('; '),
    }
  }

  const result = await built.atc.execute(ctx.algod, 4)
  return {
    txids: result.txIDs,
    confirmedRound: Number(result.confirmedRound),
    returns: built.methodIndexes.map((index, i) => ({
      index,
      value: result.methodResults[i]?.returnValue ?? null,
    })),
  }
}
