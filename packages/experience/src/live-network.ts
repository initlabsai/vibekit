import { z } from 'zod'

import type { ResultIdentity } from './live-payment.js'
import { networkStatusDataSchema } from './networks.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'

/** The JSON-safe wire subset of get_network_status metrics this slice consumes. */
export const networkStatusWireSchema = z.object({
  network: z.string().min(1),
  latestRound: z.number().int().nonnegative(),
  avgTps: z.number().finite().nonnegative(),
  avgBlockTime: z.number().finite().nonnegative(),
  participation: z.number().finite().nonnegative(),
})

/** Wraps a get_network_status result as a network status record. Extra wire fields are dropped. */
export function buildNetworkStatusRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_network_status',
): StructuredResult {
  const status = networkStatusWireSchema.parse(wire)
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
