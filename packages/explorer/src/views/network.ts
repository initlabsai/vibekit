import { z } from 'zod'

import type { ResultIdentity, StructuredResult } from '../core/results.js'
import { record, viewModelFor } from './derive.js'

/**
 * Authoritative health metrics required by the trusted network status view.
 * Extra wire fields are dropped.
 */
export const networkStatusDataSchema = z.object({
  network: z.string().min(1),
  latestRound: z.number().int().nonnegative(),
  avgTps: z.number().finite().nonnegative(),
  avgBlockTime: z.number().finite().nonnegative(),
  participation: z.number().finite().nonnegative(),
})

/** Authoritative network snapshot required by the trusted network status view. */
export type NetworkStatusData = z.infer<typeof networkStatusDataSchema>

/** Wraps a get_network_status result as a network status record. */
export function buildNetworkStatusRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_network_status',
): StructuredResult {
  return record(identity, toolName, networkStatusDataSchema.parse(wire))
}

/** Derives network presentation from one trusted result reference. */
export const createNetworkStatusViewModel = viewModelFor(
  networkStatusDataSchema,
  'network.status' as const,
  'Network status',
)

/** Renderer-ready semantic model for the trusted network status view. */
export type NetworkStatusViewModel = Extract<
  ReturnType<typeof createNetworkStatusViewModel>,
  { ok: true }
>['model']
