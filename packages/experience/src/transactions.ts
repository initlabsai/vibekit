import { z } from 'zod'

import { uint64JsonSchema } from './algo.js'
import { algorandAddressCandidateSchema, algorandTransactionIdSchema } from './classifier.js'

/** Authoritative transaction data required by the first trusted detail view. */
export const transactionDetailDataSchema = z
  .object({
    id: algorandTransactionIdSchema,
    type: z.string().min(1),
    status: z.enum(['confirmed', 'pending', 'failed']),
    sender: algorandAddressCandidateSchema,
    receiver: algorandAddressCandidateSchema.optional(),
    feeMicroAlgos: uint64JsonSchema,
    confirmedRound: z.number().int().nonnegative().optional(),
    roundTime: z.number().int().nonnegative().optional(),
    paymentAmountMicroAlgos: uint64JsonSchema.optional(),
    assetId: uint64JsonSchema.optional(),
    assetAmount: uint64JsonSchema.optional(),
    assetName: z.string().min(1).optional(),
    assetUnitName: z.string().min(1).optional(),
    assetDecimals: z.number().int().nonnegative().optional(),
    applicationId: uint64JsonSchema.optional(),
    onCompletion: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    group: z.string().min(1).optional(),
    innerCount: z.number().int().nonnegative().optional(),
    rekeyTo: algorandAddressCandidateSchema.optional(),
    closeTo: algorandAddressCandidateSchema.optional(),
    closeAmountMicroAlgos: uint64JsonSchema.optional(),
    closeAssetAmount: uint64JsonSchema.optional(),
    clawbackFrom: algorandAddressCandidateSchema.optional(),
  })
  .strict()

/** Authoritative transaction data required by the first trusted detail view. */
export type TransactionDetailData = z.infer<typeof transactionDetailDataSchema>
