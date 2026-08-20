import { z } from 'zod'

import { networkStatusDataSchema } from '../networks.js'
import type { ViewSpec } from '../protocol.js'
import { resolveResultReference, type ResultStore } from '../results.js'
import type { ViewModelError } from './transaction-detail.js'

/** Renderer-ready semantic model for the trusted network status view. */
export const networkStatusViewModelSchema = z
  .object({
    view: z.literal('network.status'),
    network: z.string().min(1),
    latestRound: z.number().int().nonnegative(),
    avgTps: z.number().finite().nonnegative(),
    avgBlockTime: z.number().finite().nonnegative(),
    participation: z.number().finite().nonnegative(),
  })
  .strict()

/** Renderer-ready semantic model for the trusted network status view. */
export type NetworkStatusViewModel = z.infer<typeof networkStatusViewModelSchema>

/** Result of deriving the renderer-ready network status model. */
export type NetworkStatusViewModelResult =
  { ok: true; model: NetworkStatusViewModel } | { ok: false; error: ViewModelError }

/** Derives network presentation from one trusted result reference. */
export function createNetworkStatusViewModel(
  store: ResultStore,
  view: ViewSpec,
): NetworkStatusViewModelResult {
  const resolution = resolveResultReference(store, view.source)
  if (!resolution.ok) return resolution

  const parsed = networkStatusDataSchema.safeParse(resolution.value)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_VIEW_DATA',
        message: 'Network result did not match the trusted network schema',
      },
    }
  }
  return {
    ok: true,
    model: networkStatusViewModelSchema.parse({
      view: 'network.status',
      ...parsed.data,
      network: parsed.data.network,
    }),
  }
}
