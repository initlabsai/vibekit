import { z } from 'zod'

import { uint64JsonSchema } from './algo.js'
import { blockDetailDataSchema } from './blocks.js'
import { algorandAddressCandidateSchema } from './classifier.js'
import type { ResultIdentity } from './live-payment.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'

/** The JSON-safe wire subset of lookup_block this slice consumes. */
export const blockWireSchema = z.object({
  round: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
  transactionCount: z.number().int().nonnegative(),
  proposer: algorandAddressCandidateSchema.optional(),
  feesCollectedMicroAlgos: uint64JsonSchema.optional(),
  proposerPayoutMicroAlgos: uint64JsonSchema.optional(),
  transactionTypes: z
    .array(z.object({ type: z.string().min(1), count: z.number().int().nonnegative() }))
    .optional(),
})

/** The capability of looking a block up as an authoritative record. */
export interface BlockLookupHost {
  lookupBlock(round: number): Promise<StructuredResult>
}

/** Wraps a lookup_block result as a block detail record. */
export function buildBlockDetailRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_block',
): StructuredResult {
  const block = blockWireSchema.parse(wire)
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data: blockDetailDataSchema.parse({
      round: block.round,
      timestamp: block.timestamp,
      transactionCount: block.transactionCount,
      ...(block.proposer === undefined ? {} : { proposer: block.proposer }),
      ...(block.feesCollectedMicroAlgos === undefined
        ? {}
        : { feesCollectedMicroAlgos: block.feesCollectedMicroAlgos }),
      ...(block.proposerPayoutMicroAlgos === undefined
        ? {}
        : { proposerPayoutMicroAlgos: block.proposerPayoutMicroAlgos }),
      ...(block.round > 0 ? { previousRound: block.round - 1 } : {}),
      nextRound: block.round + 1,
      transactionTypes: block.transactionTypes ?? [],
    }),
  })
}
