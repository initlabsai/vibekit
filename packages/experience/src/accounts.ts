import { z } from 'zod'

import { uint64JsonSchema } from './algo.js'
import { algorandAddressCandidateSchema } from './classifier.js'

/** One asset holding on an account. */
export const accountAssetHoldingSchema = z
  .object({
    assetId: uint64JsonSchema,
    amount: uint64JsonSchema.describe('Base units of the asset'),
    isFrozen: z.boolean(),
    name: z.string().min(1).optional(),
    unitName: z.string().min(1).optional(),
  })
  .strict()

/** Authoritative account data required by the trusted portfolio view. */
export const accountPortfolioDataSchema = z
  .object({
    address: algorandAddressCandidateSchema,
    balanceMicroAlgos: uint64JsonSchema,
    totalAssets: z.number().int().nonnegative(),
    assets: z.array(accountAssetHoldingSchema),
  })
  .strict()

/** Authoritative account data required by the trusted portfolio view. */
export type AccountPortfolioData = z.infer<typeof accountPortfolioDataSchema>
