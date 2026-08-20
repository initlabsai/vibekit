import { viewDataSchemas } from '@initlabs/vibekit-tools/views'
import { z } from 'zod'

import type { ViewSpec } from '../core/protocol.js'
import {
  resolveResultReference,
  structuredResultSchema,
  type ResultIdentity,
  type ResultStore,
  type StructuredResult,
  type ViewModelError,
} from '../core/results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from '../core/version.js'

/** Authoritative health metrics required by the trusted network status view. */
export const networkStatusDataSchema = z
  .object({
    network: z.string().min(1),
    latestRound: z.number().int().nonnegative(),
    avgTps: z.number().finite().nonnegative(),
    avgBlockTime: z.number().finite().nonnegative(),
    participation: z.number().finite().nonnegative(),
  })
  .strict()

/** Authoritative network snapshot required by the trusted network status view. */
export type NetworkStatusData = z.infer<typeof networkStatusDataSchema>

/** Wraps a get_network_status result as a network status record. Extra wire fields are dropped. */
export function buildNetworkStatusRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_network_status',
): StructuredResult {
  const status = viewDataSchemas['network.status'].parse(wire)
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data: networkStatusDataSchema.parse({
      network: status.network,
      latestRound: status.latestRound,
      avgTps: status.avgTps,
      avgBlockTime: status.avgBlockTime,
      participation: status.participation,
    }),
  })
}

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
