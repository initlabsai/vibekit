import { z } from 'zod'

import {
  approvalDecisionSchema,
  approvalRequestSchema,
  createApprovalDecisionEvent,
  createApprovalRequestEvent,
  createWriteStageEvent,
  writeStageEventSchema,
  type ApprovalDecision,
  type ApprovalRequest,
  type WriteStageEvent,
} from './protocol.js'
import { resultReferenceSchema, sameResultReference, type StructuredResult } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION, experienceProtocolVersionSchema } from './version.js'

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
    protocolVersion: experienceProtocolVersionSchema,
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
        protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
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

/**
 * Builds the draft event for a freshly produced draft record. The event
 * carries only the record's identifiers; correlation to later approval flows
 * from the record's tool-call id.
 */
export function createDraftEventForRecord(
  flowId: string,
  record: StructuredResult,
): WriteStageEvent {
  return createWriteStageEvent({
    stage: 'draft',
    flowId,
    toolCallId: record.toolCallId,
    draft: { source: 'result', id: record.resultId },
  })
}

/** Builds the simulate event that attaches a produced simulation record to a flow. */
export function createSimulateEventForRecord(
  flow: WriteFlowState,
  record: StructuredResult,
): WriteStageEvent {
  return createWriteStageEvent({
    stage: 'simulate',
    flowId: flow.flowId,
    simulation: { source: 'result', id: record.resultId },
  })
}

/** Builds the inspect event over the flow's simulation, or undefined before one exists. */
export function createInspectEventForFlow(flow: WriteFlowState): WriteStageEvent | undefined {
  if (!flow.simulation) return undefined
  return createWriteStageEvent({
    stage: 'inspect',
    flowId: flow.flowId,
    inspection: flow.simulation,
  })
}

/**
 * Builds the approval request over exactly the flow's inspected reference and
 * tool-call id — the correlations the machine enforces — or undefined before
 * inspection.
 */
export function createApprovalRequestForFlow(
  flow: WriteFlowState,
  requestId: string,
): ApprovalRequest | undefined {
  if (!flow.inspection) return undefined
  return createApprovalRequestEvent({
    requestId,
    toolCallId: flow.toolCallId,
    inspection: flow.inspection,
  })
}

/** Builds the sign event that attaches a produced signed-group record to a flow. */
export function createSignEventForRecord(
  flow: WriteFlowState,
  record: StructuredResult,
): WriteStageEvent {
  return createWriteStageEvent({
    stage: 'sign',
    flowId: flow.flowId,
    signed: { source: 'result', id: record.resultId },
  })
}

/** Builds the confirm event that attaches a produced confirmation record to a flow. */
export function createConfirmEventForRecord(
  flow: WriteFlowState,
  record: StructuredResult,
): WriteStageEvent {
  return createWriteStageEvent({
    stage: 'confirm',
    flowId: flow.flowId,
    confirmation: { source: 'result', id: record.resultId },
  })
}

/** Builds the decision for the flow's pending request, or undefined without one. */
export function createDecisionForFlow(
  flow: WriteFlowState,
  state: 'approved' | 'denied',
  reason?: string,
): ApprovalDecision | undefined {
  if (!flow.approvalRequest) return undefined
  return createApprovalDecisionEvent({
    requestId: flow.approvalRequest.requestId,
    state,
    ...(reason === undefined ? {} : { reason }),
  })
}

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
