import { z } from 'zod'

import { uint64JsonSchema } from './algo.js'
import { algorandAddressCandidateSchema } from './classifier.js'

/** Authoritative asset data required by the trusted asset detail view. */
export const assetDetailDataSchema = z
  .object({
    assetId: uint64JsonSchema,
    name: z.string().min(1).optional(),
    unitName: z.string().min(1).optional(),
    totalSupply: z.string().regex(/^\d+$/),
    decimals: z.number().int().nonnegative(),
    creator: algorandAddressCandidateSchema.optional(),
    manager: algorandAddressCandidateSchema.optional(),
    reserve: algorandAddressCandidateSchema.optional(),
    freeze: algorandAddressCandidateSchema.optional(),
    clawback: algorandAddressCandidateSchema.optional(),
    defaultFrozen: z.boolean().optional(),
    url: z.string().min(1).optional(),
  })
  .strict()

/** Authoritative asset data required by the trusted asset detail view. */
export type AssetDetailData = z.infer<typeof assetDetailDataSchema>
