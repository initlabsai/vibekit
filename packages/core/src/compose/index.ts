import algosdk from 'algosdk'
import type { ToolContext } from '../contract.js'
import { buildGroup, type GroupResources } from './build.js'
import { finishGroup, type ComposeOrExecuteResult } from './finish.js'
import type { TxnSpec } from './types.js'

export { buildGroup, resolveAbiMethod, type BuiltGroup, type GroupResources } from './build.js'
export { finishGroup, type ComposeOrExecuteResult, type ExecuteGroupResult } from './finish.js'
export { simulateGroup, type SimulateGroupResult, type SimulateOptions } from './simulate.js'
export type * from './types.js'

const APP_CALL_TYPES = new Set(['app_call', 'app_opt_in', 'app_close_out', 'app_delete'])

/**
 * Discover the box/account/app/asset references an app call touches, by
 * simulating the group once with unnamed resources allowed and reading back
 * what it accessed. Raw algosdk (unlike algokit-utils' AppClient) does not do
 * this, so a method that opens a box would otherwise fail with an "invalid Box
 * reference" logic error.
 *
 * ponytail: per-txn resources are attached to their own txn; group-level
 * unnamed resources are assigned to the first app call. The full 8-refs-per-txn
 * packing / IO-budget (extraBoxRefs) algorithm lives in algokit-utils; adopt it
 * if a real group ever exceeds one txn's reference budget.
 */
async function populateResources(
  ctx: ToolContext,
  specs: TxnSpec[],
): Promise<ReadonlyMap<number, GroupResources> | undefined> {
  const appCallIndexes = specs
    .map((spec, i) => (APP_CALL_TYPES.has(spec.type) ? i : -1))
    .filter((i) => i >= 0)
  if (appCallIndexes.length === 0) return undefined

  const probe = await buildGroup({ ...ctx, mode: 'compose' }, specs)
  const request = new algosdk.modelsv2.SimulateRequest({
    txnGroups: [],
    allowEmptySignatures: true,
    allowUnnamedResources: true,
  })
  // Best effort: if the probe simulate cannot run (algod unreachable), build
  // without auto-populated resources — no worse than pre-population behavior.
  let group
  try {
    const { simulateResponse } = await probe.atc.simulate(ctx.algod, request)
    group = simulateResponse.txnGroups[0]
  } catch {
    return undefined
  }
  if (!group) return undefined

  const map = new Map<number, GroupResources>()
  const toRefs = (
    u: algosdk.modelsv2.SimulateUnnamedResourcesAccessed | undefined,
  ): GroupResources => ({
    boxes: u?.boxes?.map((b) => ({ appIndex: b.app, name: b.name })),
    accounts: u?.accounts?.map((a) => a.toString()),
    foreignApps: u?.apps?.map(Number),
    foreignAssets: u?.assets?.map(Number),
  })
  group.txnResults.forEach((txnResult, i) => {
    if (txnResult.unnamedResourcesAccessed) map.set(i, toRefs(txnResult.unnamedResourcesAccessed))
  })
  // Group-level resources belong to no single txn; hang them on the first app call.
  if (group.unnamedResourcesAccessed) {
    const target = appCallIndexes[0]!
    const shared = toRefs(group.unnamedResourcesAccessed)
    const existing = map.get(target)
    map.set(target, {
      boxes: [...(existing?.boxes ?? []), ...(shared.boxes ?? [])],
      accounts: [...(existing?.accounts ?? []), ...(shared.accounts ?? [])],
      foreignApps: [...(existing?.foreignApps ?? []), ...(shared.foreignApps ?? [])],
      foreignAssets: [...(existing?.foreignAssets ?? []), ...(shared.foreignAssets ?? [])],
    })
  }
  return map
}

/**
 * The one call write tools make: build the group from specs, then either
 * return it unsigned (compose mode) or sign/send/confirm it (execute mode).
 * App-call resource references (boxes, foreign accounts/apps/assets) are
 * auto-populated via a simulate, so callers never hand-declare them.
 */
export async function composeOrExecute(
  ctx: ToolContext,
  specs: TxnSpec[],
): Promise<ComposeOrExecuteResult> {
  const resources = await populateResources(ctx, specs)
  const built = await buildGroup(ctx, specs, resources)
  return finishGroup(ctx, built, specs)
}
