import { z } from 'zod'

import { signedMicroAlgosJsonSchema, uint64JsonSchema } from './algo.js'
import { algorandAddressCandidateSchema, algorandTransactionIdSchema } from './classifier.js'

/** One simulated balance movement in signed microALGOs. */
export const paymentEffectSchema = z
  .object({
    account: algorandAddressCandidateSchema,
    deltaMicroAlgos: signedMicroAlgosJsonSchema,
  })
  .strict()

/**
 * Authoritative data of a composed, unsigned payment draft result. The
 * base64 group bytes are the ground truth the flow inspects and approves.
 */
export const paymentDraftDataSchema = z
  .object({
    sender: algorandAddressCandidateSchema,
    receiver: algorandAddressCandidateSchema,
    amountMicroAlgos: uint64JsonSchema,
    note: z.string().min(1).optional(),
    unsignedGroup: z
      .object({
        transactions: z.array(z.string().min(1)).min(1).describe('base64, group order'),
        summary: z.string().min(1),
      })
      .strict(),
  })
  .strict()

/**
 * Authoritative data of a payment simulation result. It restates the reviewed
 * group facts so the approval view has one authoritative source; the view
 * model cross-checks them against the draft before presenting.
 */
export const paymentSimulationDataSchema = z
  .object({
    wouldSucceed: z.boolean(),
    failureMessage: z.string().min(1).optional(),
    sender: algorandAddressCandidateSchema,
    receiver: algorandAddressCandidateSchema,
    amountMicroAlgos: uint64JsonSchema,
    feeMicroAlgos: uint64JsonSchema,
    group: z
      .object({
        size: z.number().int().positive(),
        transactionTypes: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    effects: z.array(paymentEffectSchema).min(1),
    simulatedRound: z.number().int().nonnegative().optional(),
  })
  .strict()

/**
 * Authoritative data of a signed payment group. The signed bytes wrap exactly
 * the approved draft group; hosts verify that correspondence before building
 * this record.
 */
export const paymentSignedGroupDataSchema = z
  .object({
    transactions: z.array(z.string().min(1)).min(1).describe('base64 signed, group order'),
    txIds: z.array(algorandTransactionIdSchema).min(1),
    signer: algorandAddressCandidateSchema,
  })
  .strict()

/** Authoritative data of a payment confirmation result. */
export const paymentConfirmationDataSchema = z
  .object({
    transactionId: algorandTransactionIdSchema,
    confirmedRound: z.number().int().positive(),
  })
  .strict()

/** Authoritative data of a composed, unsigned payment draft result. */
export type PaymentDraftData = z.infer<typeof paymentDraftDataSchema>

/** Authoritative data of a payment simulation result. */
export type PaymentSimulationData = z.infer<typeof paymentSimulationDataSchema>

/** Authoritative data of a signed payment group. */
export type PaymentSignedGroupData = z.infer<typeof paymentSignedGroupDataSchema>

/** Authoritative data of a payment confirmation result. */
export type PaymentConfirmationData = z.infer<typeof paymentConfirmationDataSchema>
