import { PLUGIN_VIEW_IDS } from '../plugins/views.js'
import { z } from 'zod'

import { resultReferenceSchema, type ResultReference } from './records.js'
import { RECORD_PROTOCOL_VERSION, recordProtocolVersionSchema } from './version.js'

/** The core view ids — one per chain-data card. */
const CORE_VIEW_IDS = [
  'transaction.detail',
  'transaction.list',
  'transaction.group',
  'account.portfolio',
  'account.summary',
  'account.list',
  'asset.detail',
  'asset.list',
  'asset.holdings',
  'asset.holders',
  'application.detail',
  'application.list',
  'application.state',
  'application.locals',
  'application.logs',
  'application.box',
  'application.boxes',
  'application.program',
  'application.methods',
  'application.explanation',
  'block.detail',
  'block.list',
  'network.status',
] as const

/** View ids hosts render as cards — core and plugin; anything else shows as a raw record. */
export const TRUSTED_VIEW_IDS = [...CORE_VIEW_IDS, ...PLUGIN_VIEW_IDS] as const

/** A view id from TRUSTED_VIEW_IDS. */
export type TrustedViewId = (typeof TRUSTED_VIEW_IDS)[number]

/** A trusted presentation specification selected by the model or direct lane. */
export const viewSpecSchema = z
  .object({
    protocolVersion: recordProtocolVersionSchema,
    type: z.literal('view'),
    view: z.enum(TRUSTED_VIEW_IDS),
    source: resultReferenceSchema,
  })
  .strict()

/** A trusted presentation specification selected by the model or direct lane. */
export type ViewSpec = z.infer<typeof viewSpecSchema>

/** A titled trusted view — what an app shows as its open view. */
export interface OpenView {
  title: string
  view: ViewSpec
}

const stageEventBase = {
  protocolVersion: recordProtocolVersionSchema,
  type: z.literal('write.stage'),
  flowId: z.string().min(1),
}

/** Begins one observable action flow around a composed, unsigned draft result. */
export const draftStageEventSchema = z
  .object({
    ...stageEventBase,
    stage: z.literal('draft'),
    toolCallId: z.string().min(1),
    draft: resultReferenceSchema,
  })
  .strict()

/** Attaches an authoritative simulation result to a drafted action flow. */
export const simulateStageEventSchema = z
  .object({
    ...stageEventBase,
    stage: z.literal('simulate'),
    simulation: resultReferenceSchema,
  })
  .strict()

/** Marks the human-visible inspection of one authoritative review result. */
export const inspectStageEventSchema = z
  .object({
    ...stageEventBase,
    stage: z.literal('inspect'),
    inspection: resultReferenceSchema,
  })
  .strict()

/** Attaches the authoritative signed-group result to an approved action flow. */
export const signStageEventSchema = z
  .object({
    ...stageEventBase,
    stage: z.literal('sign'),
    signed: resultReferenceSchema,
  })
  .strict()

/** Attaches the authoritative confirmation result to a signed action flow. */
export const confirmStageEventSchema = z
  .object({
    ...stageEventBase,
    stage: z.literal('confirm'),
    confirmation: resultReferenceSchema,
  })
  .strict()

/**
 * Observable action stage events. Each stage carries only result
 * references; authoritative senders, amounts, fees, and effects stay in
 * structured results.
 */
export const stageEventSchema = z.discriminatedUnion('stage', [
  draftStageEventSchema,
  simulateStageEventSchema,
  inspectStageEventSchema,
  signStageEventSchema,
  confirmStageEventSchema,
])

/** Observable action stage event. */
export type StageEvent = z.infer<typeof stageEventSchema>

/** A pending human approval that references authoritative inspection data. */
export const approvalRequestSchema = z
  .object({
    protocolVersion: recordProtocolVersionSchema,
    type: z.literal('approval.request'),
    requestId: z.string().min(1),
    state: z.literal('pending'),
    toolCallId: z.string().min(1),
    inspection: resultReferenceSchema,
  })
  .strict()

/** A terminal human decision correlated to a prior approval request. */
export const approvalDecisionSchema = z
  .object({
    protocolVersion: recordProtocolVersionSchema,
    type: z.literal('approval.decision'),
    requestId: z.string().min(1),
    state: z.enum(['approved', 'denied']),
    reason: z.string().min(1).optional(),
  })
  .strict()

/** A pending human approval that references authoritative inspection data. */
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>

/** A terminal human decision correlated to a prior approval request. */
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>

/** A reference-only stage payload accepted by the write stage constructors. */
type StageInput =
  | { stage: 'draft'; flowId: string; toolCallId: string; draft: ResultReference }
  | { stage: 'simulate'; flowId: string; simulation: ResultReference }
  | { stage: 'inspect'; flowId: string; inspection: ResultReference }
  | { stage: 'sign'; flowId: string; signed: ResultReference }
  | { stage: 'confirm'; flowId: string; confirmation: ResultReference }

/** Builds one versioned, validated write.stage event from ids and references. */
export function createStageEvent(input: StageInput): StageEvent {
  return stageEventSchema.parse({
    protocolVersion: RECORD_PROTOCOL_VERSION,
    type: 'write.stage',
    ...input,
  })
}

/** Builds one versioned, validated approval request over an inspection reference. */
export function createApprovalRequestEvent(input: {
  requestId: string
  toolCallId: string
  inspection: ResultReference
}): ApprovalRequest {
  return approvalRequestSchema.parse({
    protocolVersion: RECORD_PROTOCOL_VERSION,
    type: 'approval.request',
    state: 'pending',
    ...input,
  })
}

/** Builds one versioned, validated approval decision for a prior request. */
export function createApprovalDecisionEvent(input: {
  requestId: string
  state: 'approved' | 'denied'
  reason?: string
}): ApprovalDecision {
  return approvalDecisionSchema.parse({
    protocolVersion: RECORD_PROTOCOL_VERSION,
    type: 'approval.decision',
    ...input,
  })
}
