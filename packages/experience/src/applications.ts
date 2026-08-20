import { z } from 'zod'

import { uint64JsonSchema } from './algo.js'
import { algorandAddressCandidateSchema } from './classifier.js'

const stateSchema = z
  .object({
    numByteSlice: z.number().int().nonnegative(),
    numUint: z.number().int().nonnegative(),
  })
  .strict()

/** Authoritative application data required by the trusted application detail view. */
export const applicationDetailDataSchema = z
  .object({
    applicationId: uint64JsonSchema,
    creator: algorandAddressCandidateSchema.optional(),
    account: algorandAddressCandidateSchema.optional(),
    globalStateCount: z.number().int().nonnegative(),
    localStateSchema: stateSchema.optional(),
    globalStateSchema: stateSchema.optional(),
  })
  .strict()

/** Authoritative application data required by the trusted application detail view. */
export type ApplicationDetailData = z.infer<typeof applicationDetailDataSchema>
