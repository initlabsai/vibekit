import { z } from 'zod'

import { sameUint64, signedMicroAlgosJsonSchema, uint64JsonSchema } from '../algo.js'
import { algorandAddressCandidateSchema, algorandTransactionIdSchema } from '../classifier.js'
import {
  paymentConfirmationDataSchema,
  paymentDraftDataSchema,
  paymentSignedGroupDataSchema,
  paymentSimulationDataSchema,
} from '../payments.js'
import { resolveResultReference, type ResultStore } from '../results.js'
import {
  writeFlowEventKinds,
  writeFlowNextEventKinds,
  writeFlowStageSchema,
  type WriteFlowState,
} from '../write-flow.js'
import type { ViewModelError } from './transaction-detail.js'

const paymentEffectViewSchema = z
  .object({
    account: algorandAddressCandidateSchema,
    deltaMicroAlgos: signedMicroAlgosJsonSchema,
    role: z.enum(['sender', 'receiver', 'other']),
  })
  .strict()

/** Renderer-ready semantic model for one observable payment write flow. */
export const paymentFlowViewModelSchema = z
  .object({
    flow: z.literal('payment'),
    flowId: z.string().min(1),
    stage: writeFlowStageSchema,
    nextEventKinds: z.array(z.enum(writeFlowEventKinds)),
    network: z.string().min(1),
    sender: algorandAddressCandidateSchema,
    receiver: algorandAddressCandidateSchema,
    amountMicroAlgos: uint64JsonSchema,
    note: z.string().min(1).optional(),
    unsignedGroup: z
      .object({
        size: z.number().int().positive(),
        summary: z.string().min(1),
        transactions: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    simulation: z
      .object({
        wouldSucceed: z.boolean(),
        failureMessage: z.string().min(1).optional(),
        feeMicroAlgos: uint64JsonSchema,
        groupSize: z.number().int().positive(),
        transactionTypes: z.array(z.string().min(1)).min(1),
        effects: z.array(paymentEffectViewSchema).min(1),
        simulatedRound: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    approval: z
      .object({
        requestId: z.string().min(1),
        state: z.enum(['pending', 'approved', 'denied']),
        reason: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    signed: z
      .object({
        size: z.number().int().positive(),
        txIds: z.array(algorandTransactionIdSchema).min(1),
        signer: algorandAddressCandidateSchema,
      })
      .strict()
      .optional(),
    confirmation: z
      .object({
        transactionId: algorandTransactionIdSchema,
        confirmedRound: z.number().int().positive(),
      })
      .strict()
      .optional(),
  })
  .strict()

/** Renderer-ready semantic model for one observable payment write flow. */
export type PaymentFlowViewModel = z.infer<typeof paymentFlowViewModelSchema>

/** Result of deriving the renderer-ready payment flow model. */
export type PaymentFlowViewModelResult =
  { ok: true; model: PaymentFlowViewModel } | { ok: false; error: ViewModelError }

function invalid(message: string): PaymentFlowViewModelResult {
  return { ok: false, error: { code: 'INVALID_VIEW_DATA', message } }
}

/**
 * Derives one renderer-ready payment flow model from the flow's result
 * references. Authoritative sender, network, amount, fees, effects, and the
 * unsigned group bytes come from structured results; a simulation that
 * disagrees with the draft, or a record from another network, refuses to
 * present rather than showing facts the approval would not act on.
 */
export function createPaymentFlowViewModel(
  store: ResultStore,
  flow: WriteFlowState,
): PaymentFlowViewModelResult {
  const draft = resolveResultReference(store, flow.draft)
  if (!draft.ok) return draft
  const parsedDraft = paymentDraftDataSchema.safeParse(draft.value)
  if (!parsedDraft.success) {
    return invalid('Draft result did not match the payment draft schema')
  }
  const draftData = parsedDraft.data
  const network = draft.record.network

  let simulation: PaymentFlowViewModel['simulation']
  if (flow.simulation) {
    const resolution = resolveResultReference(store, flow.simulation)
    if (!resolution.ok) return resolution
    const parsed = paymentSimulationDataSchema.safeParse(resolution.value)
    if (!parsed.success) {
      return invalid('Simulation result did not match the payment simulation schema')
    }
    if (resolution.record.network !== network) {
      return invalid(
        `Simulation network ${resolution.record.network} does not match draft network ${network}`,
      )
    }
    const data = parsed.data
    if (
      data.sender !== draftData.sender ||
      data.receiver !== draftData.receiver ||
      !sameUint64(data.amountMicroAlgos, draftData.amountMicroAlgos)
    ) {
      return invalid('Simulation result does not simulate the drafted payment')
    }
    simulation = {
      wouldSucceed: data.wouldSucceed,
      ...(data.failureMessage === undefined ? {} : { failureMessage: data.failureMessage }),
      feeMicroAlgos: data.feeMicroAlgos,
      groupSize: data.group.size,
      transactionTypes: data.group.transactionTypes,
      effects: data.effects.map((effect) => ({
        ...effect,
        role:
          effect.account === draftData.sender
            ? ('sender' as const)
            : effect.account === draftData.receiver
              ? ('receiver' as const)
              : ('other' as const),
      })),
      ...(data.simulatedRound === undefined ? {} : { simulatedRound: data.simulatedRound }),
    }
  }

  let signed: PaymentFlowViewModel['signed']
  if (flow.signed) {
    const resolution = resolveResultReference(store, flow.signed)
    if (!resolution.ok) return resolution
    const parsed = paymentSignedGroupDataSchema.safeParse(resolution.value)
    if (!parsed.success) {
      return invalid('Signed result did not match the payment signed-group schema')
    }
    if (resolution.record.network !== network) {
      return invalid(
        `Signed network ${resolution.record.network} does not match draft network ${network}`,
      )
    }
    const data = parsed.data
    if (data.signer !== draftData.sender) {
      return invalid('Signed group was not signed by the drafted sender')
    }
    if (data.transactions.length !== draftData.unsignedGroup.transactions.length) {
      return invalid('Signed group size does not match the drafted group')
    }
    signed = { size: data.transactions.length, txIds: data.txIds, signer: data.signer }
  }

  let confirmation: PaymentFlowViewModel['confirmation']
  if (flow.confirmation) {
    const resolution = resolveResultReference(store, flow.confirmation)
    if (!resolution.ok) return resolution
    const parsed = paymentConfirmationDataSchema.safeParse(resolution.value)
    if (!parsed.success) {
      return invalid('Confirmation result did not match the payment confirmation schema')
    }
    if (resolution.record.network !== network) {
      return invalid(
        `Confirmation network ${resolution.record.network} does not match draft network ${network}`,
      )
    }
    if (signed && !signed.txIds.includes(parsed.data.transactionId)) {
      return invalid('Confirmation does not correspond to a signed transaction id')
    }
    confirmation = parsed.data
  }

  const model = paymentFlowViewModelSchema.parse({
    flow: 'payment',
    flowId: flow.flowId,
    stage: flow.stage,
    nextEventKinds: [...writeFlowNextEventKinds(flow)],
    network,
    sender: draftData.sender,
    receiver: draftData.receiver,
    amountMicroAlgos: draftData.amountMicroAlgos,
    ...(draftData.note === undefined ? {} : { note: draftData.note }),
    unsignedGroup: {
      size: draftData.unsignedGroup.transactions.length,
      summary: draftData.unsignedGroup.summary,
      transactions: draftData.unsignedGroup.transactions,
    },
    ...(simulation === undefined ? {} : { simulation }),
    ...(flow.approvalRequest === undefined
      ? {}
      : {
          approval: {
            requestId: flow.approvalRequest.requestId,
            state: flow.approvalDecision?.state ?? 'pending',
            ...(flow.approvalDecision?.reason === undefined
              ? {}
              : { reason: flow.approvalDecision.reason }),
          },
        }),
    ...(signed === undefined ? {} : { signed }),
    ...(confirmation === undefined ? {} : { confirmation }),
  })
  return { ok: true, model }
}
