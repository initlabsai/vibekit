/** Simulate a group without signatures: dry-run outcomes, logs, state deltas, budgets. */
import algosdk from 'algosdk'
import { bytesToBase64 } from '../codec.js'
import type { ToolContext } from '../contract.js'
import { buildGroup } from './build.js'
import type { TxnSpec } from './types.js'

export interface SimulateOptions {
  allowMoreLogging?: boolean
  allowUnnamedResources?: boolean
  extraOpcodeBudget?: number
}

export interface SimulateGroupResult {
  wouldSucceed: boolean
  failureMessage?: string
  failedAt?: number[]
  simulatedRound: number
  txids: string[]
  transactionResults: Array<{
    txid: string
    logs?: string[]
    budgetConsumed?: number
  }>
  returns: Array<{ index: number; value: unknown }>
  appBudgetAdded?: number
  appBudgetConsumed?: number
}

/** Decode log bytes to text when printable, else base64. */
function decodeLogs(logs: Uint8Array[] | undefined): string[] | undefined {
  if (!logs || logs.length === 0) return undefined
  return logs.map((log) => {
    const decoded = new TextDecoder().decode(log)
    // eslint-disable-next-line no-control-regex
    return /^[\x20-\x7E\n\r\t]*$/.test(decoded) ? decoded : bytesToBase64(log)
  })
}

export async function simulateGroup(
  ctx: ToolContext,
  specs: TxnSpec[],
  options: SimulateOptions = {},
): Promise<SimulateGroupResult> {
  // Always simulate with empty signers — no keys needed to preview outcomes.
  const built = await buildGroup({ ...ctx, mode: 'compose' }, specs)

  const request = new algosdk.modelsv2.SimulateRequest({
    txnGroups: [],
    allowEmptySignatures: true,
    allowMoreLogging: options.allowMoreLogging,
    allowUnnamedResources: options.allowUnnamedResources,
    extraOpcodeBudget: options.extraOpcodeBudget,
  })
  const { simulateResponse, methodResults } = await built.atc.simulate(ctx.algod, request)

  const group = simulateResponse.txnGroups[0]
  const txids = built.atc.buildGroup().map((t) => t.txn.txID())

  return {
    wouldSucceed: !group?.failureMessage,
    failureMessage: group?.failureMessage || undefined,
    failedAt: group?.failedAt?.map(Number),
    simulatedRound: Number(simulateResponse.lastRound),
    txids,
    transactionResults: (group?.txnResults ?? []).map((txnResult, i) => ({
      txid: txids[i] ?? '',
      logs: decodeLogs(txnResult.txnResult.logs),
      budgetConsumed:
        txnResult.appBudgetConsumed !== undefined ? Number(txnResult.appBudgetConsumed) : undefined,
    })),
    returns: built.methodIndexes.map((index, i) => ({
      index,
      value: methodResults[i]?.returnValue ?? null,
    })),
    appBudgetAdded: group?.appBudgetAdded !== undefined ? Number(group.appBudgetAdded) : undefined,
    appBudgetConsumed:
      group?.appBudgetConsumed !== undefined ? Number(group.appBudgetConsumed) : undefined,
  }
}
