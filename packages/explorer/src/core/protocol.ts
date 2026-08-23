import { z } from 'zod'

import { resultReferenceSchema, type ResultReference } from './results.js'
import { EXPLORER_PROTOCOL_VERSION, explorerProtocolVersionSchema } from './version.js'

/** Trusted view identifiers proven by the current vertical slices. */
export const TRUSTED_VIEW_IDS = [
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

/** Trusted view identifiers proven by the current vertical slices. */
export type TrustedViewId = (typeof TRUSTED_VIEW_IDS)[number]

/** A transaction detail view backed only by an authoritative result reference. */
export const transactionDetailViewSpecSchema = z
  .object({
    protocolVersion: explorerProtocolVersionSchema,
    type: z.literal('view'),
    view: z.literal('transaction.detail'),
    source: resultReferenceSchema,
  })
  .strict()

/** A trusted presentation specification selected by the model or direct lane. */
export const viewSpecSchema = z
  .object({
    protocolVersion: explorerProtocolVersionSchema,
    type: z.literal('view'),
    view: z.enum(TRUSTED_VIEW_IDS),
    source: resultReferenceSchema,
  })
  .strict()

/** A trusted presentation specification selected by the model or direct lane. */
export type ViewSpec = z.infer<typeof viewSpecSchema>

/** A titled trusted view — what a head renders as its open artifact. */
export interface ExplorerArtifact {
  title: string
  view: ViewSpec
}

const writeStageEventBase = {
  protocolVersion: explorerProtocolVersionSchema,
  type: z.literal('write.stage'),
  flowId: z.string().min(1),
}

/** Begins one observable write flow around a composed, unsigned draft result. */
export const writeDraftEventSchema = z
  .object({
    ...writeStageEventBase,
    stage: z.literal('draft'),
    toolCallId: z.string().min(1),
    draft: resultReferenceSchema,
  })
  .strict()

/** Attaches an authoritative simulation result to a drafted write flow. */
export const writeSimulateEventSchema = z
  .object({
    ...writeStageEventBase,
    stage: z.literal('simulate'),
    simulation: resultReferenceSchema,
  })
  .strict()

/** Marks the human-visible inspection of one authoritative review result. */
export const writeInspectEventSchema = z
  .object({
    ...writeStageEventBase,
    stage: z.literal('inspect'),
    inspection: resultReferenceSchema,
  })
  .strict()

/** Attaches the authoritative signed-group result to an approved write flow. */
export const writeSignEventSchema = z
  .object({
    ...writeStageEventBase,
    stage: z.literal('sign'),
    signed: resultReferenceSchema,
  })
  .strict()

/** Attaches the authoritative confirmation result to a signed write flow. */
export const writeConfirmEventSchema = z
  .object({
    ...writeStageEventBase,
    stage: z.literal('confirm'),
    confirmation: resultReferenceSchema,
  })
  .strict()

/**
 * Observable write-flow stage events. Each stage carries only result
 * references; authoritative senders, amounts, fees, and effects stay in
 * structured results.
 */
export const writeStageEventSchema = z.discriminatedUnion('stage', [
  writeDraftEventSchema,
  writeSimulateEventSchema,
  writeInspectEventSchema,
  writeSignEventSchema,
  writeConfirmEventSchema,
])

/** Observable write-flow stage event carried by the provisional protocol. */
export type WriteStageEvent = z.infer<typeof writeStageEventSchema>

/** A pending human approval that references authoritative inspection data. */
export const approvalRequestSchema = z
  .object({
    protocolVersion: explorerProtocolVersionSchema,
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
    protocolVersion: explorerProtocolVersionSchema,
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
type WriteStageInput =
  | { stage: 'draft'; flowId: string; toolCallId: string; draft: ResultReference }
  | { stage: 'simulate'; flowId: string; simulation: ResultReference }
  | { stage: 'inspect'; flowId: string; inspection: ResultReference }
  | { stage: 'sign'; flowId: string; signed: ResultReference }
  | { stage: 'confirm'; flowId: string; confirmation: ResultReference }

/** Builds one versioned, validated write.stage event from ids and references. */
export function createWriteStageEvent(input: WriteStageInput): WriteStageEvent {
  return writeStageEventSchema.parse({
    protocolVersion: EXPLORER_PROTOCOL_VERSION,
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
    protocolVersion: EXPLORER_PROTOCOL_VERSION,
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
    protocolVersion: EXPLORER_PROTOCOL_VERSION,
    type: 'approval.decision',
    ...input,
  })
}
