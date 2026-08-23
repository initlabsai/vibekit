import { viewDataSchemas } from '@initlabs/vibekit-tools/views'
import { z } from 'zod'

import { sameUint64, signedMicroAlgosJsonSchema, uint64JsonSchema } from '../core/algo.js'
import {
  buildTransactionsGraph,
  transactionsGraphSchema,
  type GraphTransaction,
} from '../views/transaction-graph.js'
import { algorandAddressCandidateSchema, algorandTransactionIdSchema } from '../core/classifier.js'
import {
  approvalDecisionSchema,
  approvalRequestSchema,
  writeStageEventSchema,
} from '../core/protocol.js'
import {
  resolveResultReference,
  resultReferenceSchema,
  sameResultReference,
  type ResultStore,
  type ViewModelError,
} from '../core/results.js'
import { EXPLORER_PROTOCOL_VERSION, explorerProtocolVersionSchema } from '../core/version.js'

/** One simulated balance movement in signed microALGOs. */
export const paymentEffectSchema = z
  .object({
    account: algorandAddressCandidateSchema,
    deltaMicroAlgos: signedMicroAlgosJsonSchema,
  })
  .strict()

/**
 * Authoritative data of a composed, unsigned write-group draft. The base64
 * group bytes are the ground truth the flow inspects and approves. Payment
 * receiver/amount are present when the group is a single plain pay.
 */
export const paymentDraftDataSchema = z
  .object({
    sender: algorandAddressCandidateSchema,
    receiver: algorandAddressCandidateSchema.optional(),
    amountMicroAlgos: uint64JsonSchema.optional(),
    note: z.string().min(1).optional(),
    feeMicroAlgos: uint64JsonSchema,
    transactionTypes: z.array(z.string().min(1)).min(1),
    unsignedGroup: z
      .object({
        transactions: z.array(z.string().min(1)).min(1).describe('base64, group order'),
        summary: z.string().min(1),
      })
      .strict(),
    // Decoded txn rows for the flow graph; omitted on records that predate L4.
    graphTransactions: z.array(viewDataSchemas['transaction.detail']).min(1).optional(),
  })
  .strict()

/**
 * Authoritative data of a write-group simulation. It restates the reviewed
 * group facts so the approval view has one authoritative source; the view
 * model cross-checks them against the draft before presenting.
 */
export const paymentSimulationDataSchema = z
  .object({
    wouldSucceed: z.boolean(),
    failureMessage: z.string().min(1).optional(),
    sender: algorandAddressCandidateSchema,
    receiver: algorandAddressCandidateSchema.optional(),
    amountMicroAlgos: uint64JsonSchema.optional(),
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

/**
 * Observable stages of one write flow: every state the constitution requires
 * a write UI to preserve — draft, simulation, inspection, explicit approval,
 * signing, and confirmation. `signed` is reachable only from `approved`, so a
 * signature can never exist without a recorded human decision before it.
 */
export const writeFlowStageSchema = z.enum([
  'drafted',
  'simulated',
  'inspected',
  'awaiting-approval',
  'approved',
  'denied',
  'signed',
  'confirmed',
])

/** Observable stage of one write flow. */
export type WriteFlowStage = z.infer<typeof writeFlowStageSchema>

/**
 * Any protocol event that can advance a write flow. Approval request and
 * decision are the same first-class protocol events every other consumer
 * sees; the flow machine adds ordering, never a private approval channel.
 */
export const writeFlowEventSchema = z.union([
  writeStageEventSchema,
  approvalRequestSchema,
  approvalDecisionSchema,
])

/** Any protocol event that can advance a write flow. */
export type WriteFlowEvent = z.infer<typeof writeFlowEventSchema>

const STAGE_RANK: Record<WriteFlowStage, number> = {
  drafted: 0,
  simulated: 1,
  inspected: 2,
  'awaiting-approval': 3,
  approved: 4,
  denied: 4,
  signed: 5,
  confirmed: 6,
}

/**
 * The accumulated state of one write flow. Every field is a protocol value or
 * a result reference; authoritative amounts and addresses never appear here.
 */
export const writeFlowStateSchema = z
  .object({
    protocolVersion: explorerProtocolVersionSchema,
    flowId: z.string().min(1),
    toolCallId: z.string().min(1),
    stage: writeFlowStageSchema,
    draft: resultReferenceSchema,
    simulation: resultReferenceSchema.optional(),
    inspection: resultReferenceSchema.optional(),
    approvalRequest: approvalRequestSchema.optional(),
    approvalDecision: approvalDecisionSchema.optional(),
    signed: resultReferenceSchema.optional(),
    confirmation: resultReferenceSchema.optional(),
  })
  .strict()
  .superRefine((state, context) => {
    const rank = STAGE_RANK[state.stage]
    const expectations: Array<[string, boolean, boolean]> = [
      ['simulation', state.simulation !== undefined, rank >= 1],
      ['inspection', state.inspection !== undefined, rank >= 2],
      ['approvalRequest', state.approvalRequest !== undefined, rank >= 3],
      ['approvalDecision', state.approvalDecision !== undefined, rank >= 4],
      ['signed', state.signed !== undefined, rank >= 5],
      ['confirmation', state.confirmation !== undefined, state.stage === 'confirmed'],
    ]
    for (const [field, present, expected] of expectations) {
      if (present !== expected) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: `Stage ${state.stage} ${expected ? 'requires' : 'forbids'} ${field}`,
        })
      }
    }
    if (state.approvalRequest) {
      if (state.approvalRequest.toolCallId !== state.toolCallId) {
        context.addIssue({
          code: 'custom',
          path: ['approvalRequest', 'toolCallId'],
          message: 'Approval request does not correlate to the flow tool call',
        })
      }
      if (
        !state.inspection ||
        !sameResultReference(state.approvalRequest.inspection, state.inspection)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['approvalRequest', 'inspection'],
          message: 'Approval request must reference exactly the inspected result',
        })
      }
    }
    if (state.approvalDecision) {
      if (state.approvalDecision.requestId !== state.approvalRequest?.requestId) {
        context.addIssue({
          code: 'custom',
          path: ['approvalDecision', 'requestId'],
          message: 'Approval decision does not correlate to the pending request',
        })
      }
      const expectedDecision = state.stage === 'denied' ? 'denied' : 'approved'
      if (state.approvalDecision.state !== expectedDecision) {
        context.addIssue({
          code: 'custom',
          path: ['approvalDecision', 'state'],
          message: `Stage ${state.stage} requires a ${expectedDecision} decision`,
        })
      }
    }
  })

/** The accumulated state of one write flow. */
export type WriteFlowState = z.infer<typeof writeFlowStateSchema>

/** Typed refusal of an out-of-order or miscorrelated write-flow event. */
export interface WriteFlowTransitionError {
  code: 'INVALID_TRANSITION' | 'FLOW_MISMATCH' | 'APPROVAL_MISMATCH'
  message: string
}

/** Result of applying one protocol event to a write flow. */
export type WriteFlowTransition =
  { ok: true; state: WriteFlowState } | { ok: false; error: WriteFlowTransitionError }

function refuse(code: WriteFlowTransitionError['code'], message: string): WriteFlowTransition {
  return { ok: false, error: { code, message } }
}

function accept(state: WriteFlowState): WriteFlowTransition {
  return { ok: true, state: writeFlowStateSchema.parse(state) }
}

/**
 * Applies one validated protocol event to a write flow without mutating the
 * prior value. Passing `null` state starts a flow from a draft event. Every
 * skipped or repeated stage is an explicit typed refusal, never a silent
 * success, so every write state stays observable.
 */
export function writeFlowReducer(
  state: WriteFlowState | null,
  rawEvent: WriteFlowEvent,
): WriteFlowTransition {
  const event = writeFlowEventSchema.parse(rawEvent)

  if (state === null) {
    if (event.type === 'write.stage' && event.stage === 'draft') {
      return accept({
        protocolVersion: EXPLORER_PROTOCOL_VERSION,
        flowId: event.flowId,
        toolCallId: event.toolCallId,
        stage: 'drafted',
        draft: event.draft,
      })
    }
    return refuse('INVALID_TRANSITION', 'No write flow has been drafted')
  }

  if (event.type === 'write.stage') {
    if (event.stage === 'draft') {
      return refuse('INVALID_TRANSITION', `Flow ${state.flowId} is already drafted`)
    }
    if (event.flowId !== state.flowId) {
      return refuse('FLOW_MISMATCH', `Event addresses flow ${event.flowId}, not ${state.flowId}`)
    }
    switch (event.stage) {
      case 'simulate': {
        if (state.stage !== 'drafted') {
          return refuse('INVALID_TRANSITION', `Cannot simulate from stage ${state.stage}`)
        }
        return accept({
          ...state,
          stage: 'simulated',
          simulation: event.simulation,
        })
      }
      case 'inspect': {
        if (state.stage !== 'simulated') {
          return refuse('INVALID_TRANSITION', `Cannot inspect from stage ${state.stage}`)
        }
        return accept({
          ...state,
          stage: 'inspected',
          inspection: event.inspection,
        })
      }
      case 'sign': {
        if (state.stage !== 'approved') {
          return refuse('INVALID_TRANSITION', `Cannot sign from stage ${state.stage}`)
        }
        return accept({
          ...state,
          stage: 'signed',
          signed: event.signed,
        })
      }
      case 'confirm': {
        if (state.stage !== 'signed') {
          return refuse('INVALID_TRANSITION', `Cannot confirm from stage ${state.stage}`)
        }
        return accept({
          ...state,
          stage: 'confirmed',
          confirmation: event.confirmation,
        })
      }
    }
  }

  if (event.type === 'approval.request') {
    if (state.stage !== 'inspected') {
      return refuse('INVALID_TRANSITION', `Cannot request approval from stage ${state.stage}`)
    }
    if (event.toolCallId !== state.toolCallId) {
      return refuse(
        'APPROVAL_MISMATCH',
        `Approval request addresses tool call ${event.toolCallId}, not ${state.toolCallId}`,
      )
    }
    if (!state.inspection || !sameResultReference(event.inspection, state.inspection)) {
      return refuse(
        'APPROVAL_MISMATCH',
        'Approval request must reference exactly the inspected result',
      )
    }
    return accept({
      ...state,
      stage: 'awaiting-approval',
      approvalRequest: event,
    })
  }

  if (state.stage !== 'awaiting-approval' || !state.approvalRequest) {
    return refuse('INVALID_TRANSITION', `Cannot decide approval from stage ${state.stage}`)
  }
  if (event.requestId !== state.approvalRequest.requestId) {
    return refuse(
      'APPROVAL_MISMATCH',
      `Decision addresses request ${event.requestId}, not ${state.approvalRequest.requestId}`,
    )
  }
  return accept({
    ...state,
    stage: event.state === 'approved' ? 'approved' : 'denied',
    approvalDecision: event,
  })
}

/** Semantic event kinds a client can offer next, one per legal transition. */
export const writeFlowEventKinds = [
  'draft',
  'simulate',
  'inspect',
  'request-approval',
  'approve',
  'deny',
  'sign',
  'confirm',
] as const

/** Semantic event kind a client can offer next. */
export type WriteFlowEventKind = (typeof writeFlowEventKinds)[number]

/** Lists the event kinds the machine accepts next, for renderer affordances. */
export function writeFlowNextEventKinds(
  state: WriteFlowState | null,
): readonly WriteFlowEventKind[] {
  if (state === null) return ['draft']
  switch (state.stage) {
    case 'drafted':
      return ['simulate']
    case 'simulated':
      return ['inspect']
    case 'inspected':
      return ['request-approval']
    case 'awaiting-approval':
      return ['approve', 'deny']
    case 'approved':
      return ['sign']
    case 'signed':
      return ['confirm']
    case 'denied':
    case 'confirmed':
      return []
  }
}

const paymentEffectViewSchema = z
  .object({
    account: algorandAddressCandidateSchema,
    deltaMicroAlgos: signedMicroAlgosJsonSchema,
    role: z.enum(['sender', 'receiver', 'other']),
  })
  .strict()

/** Renderer-ready semantic model for one observable write flow. */
export const paymentFlowViewModelSchema = z
  .object({
    flow: z.literal('payment'),
    flowId: z.string().min(1),
    stage: writeFlowStageSchema,
    nextEventKinds: z.array(z.enum(writeFlowEventKinds)),
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
 * Derives one renderer-ready write-flow model from the flow's result
 * references. Authoritative sender, network, fees, effects, and the unsigned
 * group bytes come from structured results; a simulation that disagrees with
 * the draft, or a record from another network, refuses to present rather
 * than showing facts the approval would not act on.
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

  let graph: PaymentFlowViewModel['graph']
  if (draftData.graphTransactions && draftData.graphTransactions.length > 0) {
    try {
      const built = buildTransactionsGraph(draftData.graphTransactions as GraphTransaction[])
      if (built.horizontals.length > 0) graph = built
    } catch {
      // A group the graph mapper does not model still presents as facts.
    }
  }

  const model = paymentFlowViewModelSchema.parse({
    flow: 'payment',
    flowId: flow.flowId,
    stage: flow.stage,
    nextEventKinds: [...writeFlowNextEventKinds(flow)],
    network,
    sender: draftData.sender,
    ...(draftData.receiver === undefined ? {} : { receiver: draftData.receiver }),
    ...(draftData.amountMicroAlgos === undefined ? {} : { amountMicroAlgos: draftData.amountMicroAlgos }),
    ...(draftData.note === undefined ? {} : { note: draftData.note }),
    unsignedGroup: {
      size: draftData.unsignedGroup.transactions.length,
      summary: draftData.unsignedGroup.summary,
      transactions: draftData.unsignedGroup.transactions,
    },
    ...(graph === undefined ? {} : { graph }),
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
