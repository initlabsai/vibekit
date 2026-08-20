import algosdk from 'algosdk'
import { viewDataSchemas } from '@initlabs/vibekit-tools/views'

import { applicationDetailDataSchema } from './applications.js'
import type { ResultIdentity } from './live-payment.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'

/** The capability of looking an application up as an authoritative record. */
export interface ApplicationLookupHost {
  lookupApplication(applicationId: number): Promise<StructuredResult>
}

/** Wraps a lookup_application result as an application detail record. */
export function buildApplicationDetailRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_application',
): StructuredResult {
  const application = viewDataSchemas['application.detail'].parse(wire)
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data: applicationDetailDataSchema.parse({
      applicationId: application.applicationId,
      account: String(algosdk.getApplicationAddress(BigInt(application.applicationId))),
      globalStateCount: application.globalState?.length ?? 0,
      ...(application.creator === undefined ? {} : { creator: application.creator }),
      ...(application.localStateSchema === undefined
        ? {}
        : { localStateSchema: application.localStateSchema }),
      ...(application.globalStateSchema === undefined
        ? {}
        : { globalStateSchema: application.globalStateSchema }),
    }),
  })
}
