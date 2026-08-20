import { z } from 'zod'

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
  feesCollected: z.number().finite().nonnegative().optional(),
  proposerPayout: z.number().finite().nonnegative().optional(),
  transactionTypes: z
    .array(z.object({ type: z.string().min(1), count: z.number().int().nonnegative() }))
    .optional(),
})

/** The capability of looking a block up as an authoritative record. */
export interface BlockLookupHost {
  lookupBlock(round: number): Promise<StructuredResult>
}

/** Wraps a lookup_block result as a block detail record. Fees on the wire are ALGO floats. */
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
      ...(block.feesCollected === undefined
        ? {}
        : { feesCollectedMicroAlgos: Math.round(block.feesCollected * 1_000_000) }),
      ...(block.proposerPayout === undefined
        ? {}
        : { proposerPayoutMicroAlgos: Math.round(block.proposerPayout * 1_000_000) }),
      ...(block.round > 0 ? { previousRound: block.round - 1 } : {}),
      nextRound: block.round + 1,
      transactionTypes: block.transactionTypes ?? [],
    }),
  })
}
