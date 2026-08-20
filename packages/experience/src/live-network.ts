import { z } from 'zod'

import type { ResultIdentity } from './live-payment.js'
import { networkStatusDataSchema } from './networks.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'

/** The JSON-safe wire subset of get_network / get_network_status this slice consumes. */
export const networkStatusWireSchema = z.object({
  network: z.string().min(1),
  mode: z.enum(['execute', 'compose']).optional(),
  servedNetworks: z.array(z.string().min(1)).optional(),
  latestRound: z.number().int().nonnegative().optional(),
  avgTps: z.number().finite().nonnegative().optional(),
  avgBlockTime: z.number().finite().nonnegative().optional(),
  participation: z.number().finite().nonnegative().optional(),
  algodUrl: z.string().min(1).optional(),
  indexerUrl: z.string().min(1).optional(),
})

/** Wraps a network tool result as a network status record. Extra wire fields are dropped. */
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
      ...(status.mode === undefined ? {} : { mode: status.mode }),
      ...(status.servedNetworks === undefined ? {} : { servedNetworks: status.servedNetworks }),
      ...(status.latestRound === undefined ? {} : { latestRound: status.latestRound }),
      ...(status.avgTps === undefined ? {} : { avgTps: status.avgTps }),
      ...(status.avgBlockTime === undefined ? {} : { avgBlockTime: status.avgBlockTime }),
      ...(status.participation === undefined ? {} : { participation: status.participation }),
      ...(status.algodUrl === undefined ? {} : { algodUrl: status.algodUrl }),
      ...(status.indexerUrl === undefined ? {} : { indexerUrl: status.indexerUrl }),
    }),
  })
}
