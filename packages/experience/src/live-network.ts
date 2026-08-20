import { viewDataSchemas } from '@initlabs/vibekit-tools/views'

import type { ResultIdentity } from './live-payment.js'
import { networkStatusDataSchema } from './networks.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'

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
