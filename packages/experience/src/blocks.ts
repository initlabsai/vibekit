import { z } from 'zod'

import { uint64JsonSchema } from './algo.js'
import { algorandAddressCandidateSchema } from './classifier.js'

/** Counts of each transaction type in a block (pay, axfer, appl, …). */
export const blockTransactionTypeCountSchema = z
  .object({
    type: z.string().min(1),
    count: z.number().int().nonnegative(),
  })
  .strict()

/** Authoritative block data required by the trusted block detail view. */
export const blockDetailDataSchema = z
  .object({
    round: z.number().int().nonnegative(),
    timestamp: z.number().int().nonnegative(),
    transactionCount: z.number().int().nonnegative(),
    proposer: algorandAddressCandidateSchema.optional(),
    feesCollectedMicroAlgos: uint64JsonSchema.optional(),
    proposerPayoutMicroAlgos: uint64JsonSchema.optional(),
    previousRound: z.number().int().nonnegative().optional(),
    nextRound: z.number().int().nonnegative().optional(),
    transactionTypes: z.array(blockTransactionTypeCountSchema).default([]),
  })
  .strict()

/** Authoritative block data required by the trusted block detail view. */
export type BlockDetailData = z.infer<typeof blockDetailDataSchema>
