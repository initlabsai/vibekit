/**
 * The view model an approval screen renders for one action: authoritative
 * sender, network, fees, effects, the unsigned group, and the transactions
 * graph — all from the flow's records, never from request parameters.
 */
import { writeIntentSchema } from '@initlabs/vibekit'
import {
  actionEventKinds,
  actionNextEventKinds,
  actionStageSchema,
  algorandAddressCandidateSchema,
  algorandTransactionIdSchema,
  confirmationDataSchema,
  resolveResultReference,
  sameUint64,
  signedGroupDataSchema,
  signedMicroAlgosJsonSchema,
  uint64JsonSchema,
  writeDraftDataSchema,
  writeSimulationDataSchema,
  type ActionState,
  type ResultStore,
  type ViewModelError,
} from '@initlabs/vibekit/actions'
import { z } from 'zod'

import {
  buildTransactionsGraph,
  transactionsGraphSchema,
  type GraphTransaction,
} from './transaction-graph.js'

const paymentEffectViewSchema = z
  .object({
    account: algorandAddressCandidateSchema,
    deltaMicroAlgos: signedMicroAlgosJsonSchema,
    role: z.enum(['sender', 'receiver', 'other']),
  })
  .strict()

/** Renderer-ready semantic model for one observable action flow. */
export const actionViewModelSchema = z
  .object({
    flow: z.literal('payment'),
    flowId: z.string().min(1),
    stage: actionStageSchema,
    nextEventKinds: z.array(z.enum(actionEventKinds)),
    network: z.string().min(1),
    sender: algorandAddressCandidateSchema,
    receiver: algorandAddressCandidateSchema.optional(),
    amountMicroAlgos: uint64JsonSchema.optional(),
    note: z.string().min(1).optional(),
    unsignedGroup: z
      .object({
        size: z.number().int().positive(),
        summary: z.string().min(1),
        transactions: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    graph: transactionsGraphSchema.optional(),
    /** Legs the wallet does not sign (a router's), by group index. */
    presignedIndexes: z.array(z.number().int().nonnegative()).optional(),
    intent: writeIntentSchema.optional(),
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

/** Renderer-ready semantic model for one observable payment action flow. */
export type ActionViewModel = z.infer<typeof actionViewModelSchema>

/** Result of deriving the payment flow view model. */
export type ActionViewModelResult =
  { ok: true; model: ActionViewModel } | { ok: false; error: ViewModelError }

function invalid(message: string): ActionViewModelResult {
  return { ok: false, error: { code: 'INVALID_VIEW_DATA', message } }
}

/**
 * Derives one action view model from the flow's result
 * references. Authoritative sender, network, fees, effects, and the unsigned
 * group bytes come from structured results; a simulation that disagrees with
 * the draft, or a record from another network, refuses to present rather
 * than showing facts the approval would not act on.
 */
export function createActionViewModel(
  store: ResultStore,
  flow: ActionState,
): ActionViewModelResult {
  const draft = resolveResultReference(store, flow.draft)
  if (!draft.ok) return draft
  const parsedDraft = writeDraftDataSchema.safeParse(draft.value)
  if (!parsedDraft.success) {
    return invalid('Draft result did not match the payment draft schema')
  }
  const draftData = parsedDraft.data
  const network = draft.record.network

  let simulation: ActionViewModel['simulation']
  if (flow.simulation) {
    const resolution = resolveResultReference(store, flow.simulation)
    if (!resolution.ok) return resolution
    const parsed = writeSimulationDataSchema.safeParse(resolution.value)
    if (!parsed.success) {
      return invalid('Simulation result did not match the payment simulation schema')
    }
    if (resolution.record.network !== network) {
      return invalid(
        `Simulation network ${resolution.record.network} does not match draft network ${network}`,
      )
    }
    const data = parsed.data
    if (data.sender !== draftData.sender) {
      return invalid('Simulation result does not simulate the drafted group')
    }
    if (data.group.size !== draftData.unsignedGroup.transactions.length) {
      return invalid('Simulation group size does not match the drafted group')
    }
    if (
      draftData.receiver !== undefined &&
      data.receiver !== undefined &&
      data.receiver !== draftData.receiver
    ) {
      return invalid('Simulation result does not simulate the drafted payment')
    }
    if (
      draftData.amountMicroAlgos !== undefined &&
      data.amountMicroAlgos !== undefined &&
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
            : draftData.receiver !== undefined && effect.account === draftData.receiver
              ? ('receiver' as const)
              : ('other' as const),
      })),
      ...(data.simulatedRound === undefined ? {} : { simulatedRound: data.simulatedRound }),
    }
  }

  let signed: ActionViewModel['signed']
  if (flow.signed) {
    const resolution = resolveResultReference(store, flow.signed)
    if (!resolution.ok) return resolution
    const parsed = signedGroupDataSchema.safeParse(resolution.value)
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

  let confirmation: ActionViewModel['confirmation']
  if (flow.confirmation) {
    const resolution = resolveResultReference(store, flow.confirmation)
    if (!resolution.ok) return resolution
    const parsed = confirmationDataSchema.safeParse(resolution.value)
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

  let graph: ActionViewModel['graph']
  if (draftData.graphTransactions && draftData.graphTransactions.length > 0) {
    try {
      const built = buildTransactionsGraph(draftData.graphTransactions as GraphTransaction[])
      if (built.horizontals.length > 0) graph = built
    } catch {
      // A group the graph mapper does not model still presents as facts.
    }
  }

  const model = actionViewModelSchema.parse({
    flow: 'payment',
    flowId: flow.flowId,
    stage: flow.stage,
    nextEventKinds: [...actionNextEventKinds(flow)],
    network,
    sender: draftData.sender,
    ...(draftData.receiver === undefined ? {} : { receiver: draftData.receiver }),
    ...(draftData.amountMicroAlgos === undefined
      ? {}
      : { amountMicroAlgos: draftData.amountMicroAlgos }),
    ...(draftData.note === undefined ? {} : { note: draftData.note }),
    unsignedGroup: {
      size: draftData.unsignedGroup.transactions.length,
      summary: draftData.unsignedGroup.summary,
      transactions: draftData.unsignedGroup.transactions,
    },
    ...(graph === undefined ? {} : { graph }),
    ...(draftData.presigned === undefined
      ? {}
      : {
          presignedIndexes: draftData.presigned
            .map((leg, index) => (leg === null ? -1 : index))
            .filter((index) => index >= 0),
        }),
    ...(draftData.intent === undefined ? {} : { intent: draftData.intent }),
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
