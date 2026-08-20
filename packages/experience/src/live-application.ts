import algosdk from 'algosdk'
import { z } from 'zod'

import { applicationDetailDataSchema } from './applications.js'
import { uint64JsonSchema } from './algo.js'
import { algorandAddressCandidateSchema } from './classifier.js'
import type { ResultIdentity } from './live-payment.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'

const stateSchema = z.object({
  numByteSlice: z.number().int().nonnegative(),
  numUint: z.number().int().nonnegative(),
})

/** The JSON-safe wire subset of lookup_application this slice consumes. */
export const applicationWireSchema = z.object({
  applicationId: uint64JsonSchema,
  creator: algorandAddressCandidateSchema.optional(),
  globalState: z.array(z.unknown()).optional(),
  localStateSchema: stateSchema.optional(),
  globalStateSchema: stateSchema.optional(),
})

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
  const application = applicationWireSchema.parse(wire)
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
