/**
 * The action machine: the data each stage records and the stage reducer.
 * Payment-shaped fields (receiver, amount) are present when the group is one
 * plain pay. The view model an approval screen renders lives with the views.
 */
import { z } from 'zod'

import { writeIntentSchema } from '../core/schemas.js'
import { viewDataSchemas } from '../tools/views.js'
import { approvalDecisionSchema, approvalRequestSchema, writeStageEventSchema } from './protocol.js'
import { resultReferenceSchema, sameResultReference } from './records.js'
import {
  algorandAddressCandidateSchema,
  algorandTransactionIdSchema,
  signedMicroAlgosJsonSchema,
  uint64JsonSchema,
} from './schemas.js'
import { RECORD_PROTOCOL_VERSION, recordProtocolVersionSchema } from './version.js'

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
export const writeDraftDataSchema = z
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
    // Decoded txn rows for the flow graph; optional so older recorded fixtures still parse.
    graphTransactions: z.array(viewDataSchemas['transaction.detail']).min(1).optional(),
    /** Per index: a base64 signed leg another party signed, or null where the wallet signs. */
    presigned: z.array(z.string().min(1).nullable()).optional(),
    /** What the group does, when a screen can say it better than its transactions. */
    intent: writeIntentSchema.optional(),
  })
  .strict()

/**
 * Authoritative data of a write-group simulation. It restates the reviewed
 * group facts so the approval view has one authoritative source; the view
 * model cross-checks them against the draft before presenting.
 */
export const writeSimulationDataSchema = z
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
export const signedGroupDataSchema = z
  .object({
    transactions: z.array(z.string().min(1)).min(1).describe('base64 signed, group order'),
    txIds: z.array(algorandTransactionIdSchema).min(1),
    signer: algorandAddressCandidateSchema,
  })
  .strict()

/** Authoritative data of a payment confirmation result. */
export const confirmationDataSchema = z
  .object({
    transactionId: algorandTransactionIdSchema,
    confirmedRound: z.number().int().positive(),
  })
  .strict()

/** Authoritative data of a composed, unsigned payment draft result. */
export type WriteDraftData = z.infer<typeof writeDraftDataSchema>

/** Authoritative data of a payment simulation result. */
export type WriteSimulationData = z.infer<typeof writeSimulationDataSchema>

/** Authoritative data of a signed payment group. */
export type SignedGroupData = z.infer<typeof signedGroupDataSchema>

/** Authoritative data of a payment confirmation result. */
export type ConfirmationData = z.infer<typeof confirmationDataSchema>

/**
 * Observable stages of one action flow: every state the constitution requires
 * a write UI to preserve — draft, simulation, inspection, explicit approval,
 * signing, and confirmation. `signed` is reachable only from `approved`, so a
 * signature can never exist without a recorded human decision before it.
 */
export const actionStageSchema = z.enum([
  'drafted',
  'simulated',
  'inspected',
  'awaiting-approval',
  'approved',
  'denied',
  'signed',
  'confirmed',
])

/** Observable stage of one action flow. */
export type ActionStage = z.infer<typeof actionStageSchema>

/**
 * Any protocol event that can advance a action flow. Approval request and
 * decision are the same first-class protocol events every other consumer
 * sees; the flow machine adds ordering, never a private approval channel.
 */
export const actionEventSchema = z.union([
  writeStageEventSchema,
  approvalRequestSchema,
  approvalDecisionSchema,
])

/** Any protocol event that can advance a action flow. */
export type ActionEvent = z.infer<typeof actionEventSchema>

const STAGE_RANK: Record<ActionStage, number> = {
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
 * The accumulated state of one action flow. Every field is a protocol value or
 * a result reference; authoritative amounts and addresses never appear here.
 */
export const actionStateSchema = z
  .object({
    protocolVersion: recordProtocolVersionSchema,
    flowId: z.string().min(1),
    toolCallId: z.string().min(1),
    stage: actionStageSchema,
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

/** The accumulated state of one action flow. */
export type ActionState = z.infer<typeof actionStateSchema>

/** Typed refusal of an out-of-order or miscorrelated action event. */
export interface ActionTransitionError {
  code: 'INVALID_TRANSITION' | 'FLOW_MISMATCH' | 'APPROVAL_MISMATCH'
  message: string
}

/** Result of applying one protocol event to a action flow. */
export type ActionTransition =
  { ok: true; state: ActionState } | { ok: false; error: ActionTransitionError }

function refuse(code: ActionTransitionError['code'], message: string): ActionTransition {
  return { ok: false, error: { code, message } }
}

function accept(state: ActionState): ActionTransition {
  return { ok: true, state: actionStateSchema.parse(state) }
}

/**
 * Applies one validated protocol event to a action flow without mutating the
 * prior value. Passing `null` state starts a flow from a draft event. Every
 * skipped or repeated stage is an explicit typed refusal, never a silent
 * success, so every write state stays observable.
 */
export function actionReducer(
  state: ActionState | null,
  rawEvent: ActionEvent,
): ActionTransition {
  const event = actionEventSchema.parse(rawEvent)

  if (state === null) {
    if (event.type === 'write.stage' && event.stage === 'draft') {
      return accept({
        protocolVersion: RECORD_PROTOCOL_VERSION,
        flowId: event.flowId,
        toolCallId: event.toolCallId,
        stage: 'drafted',
        draft: event.draft,
      })
    }
    return refuse('INVALID_TRANSITION', 'No action flow has been drafted')
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
export const actionEventKinds = [
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
export type ActionEventKind = (typeof actionEventKinds)[number]

/** Lists the event kinds the machine accepts next, so an app can enable the right controls. */
export function actionNextEventKinds(
  state: ActionState | null,
): readonly ActionEventKind[] {
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
