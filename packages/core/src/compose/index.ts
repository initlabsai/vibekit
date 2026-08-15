import type { ToolContext } from '../contract.js'
import { buildGroup } from './build.js'
import { finishGroup, type ComposeOrExecuteResult } from './finish.js'
import type { TxnSpec } from './types.js'

export { buildGroup, resolveAbiMethod, type BuiltGroup } from './build.js'
export { finishGroup, type ComposeOrExecuteResult, type ExecuteGroupResult } from './finish.js'
export { simulateGroup, type SimulateGroupResult, type SimulateOptions } from './simulate.js'
export type * from './types.js'

/**
 * The one call write tools make: build the group from specs, then either
 * return it unsigned (compose mode) or sign/send/confirm it (execute mode).
 */
export async function composeOrExecute(
  ctx: ToolContext,
  specs: TxnSpec[],
): Promise<ComposeOrExecuteResult> {
  const built = await buildGroup(ctx, specs)
  return finishGroup(ctx, built, specs)
}
