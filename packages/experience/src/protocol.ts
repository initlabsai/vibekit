import { z } from 'zod'

import { resultReferenceSchema, structuredResultSchema, type ResultReference } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION, experienceProtocolVersionSchema } from './version.js'

/** Trusted view identifiers proven by the current vertical slices. */
export const TRUSTED_VIEW_IDS = ['transaction.detail', 'account.portfolio'] as const

/** The trusted view registry accepted by the current provisional protocol. */
export const trustedViewIdSchema = z.enum(TRUSTED_VIEW_IDS)

/** A transaction detail view backed only by an authoritative result reference. */
export const transactionDetailViewSpecSchema = z
  .object({
    protocolVersion: experienceProtocolVersionSchema,
    type: z.literal('view'),
    view: z.literal('transaction.detail'),
    source: resultReferenceSchema,
  })
  .strict()

/** An account portfolio view backed only by an authoritative result reference. */
export const accountPortfolioViewSpecSchema = z
  .object({
    protocolVersion: experienceProtocolVersionSchema,
    type: z.literal('view'),
    view: z.literal('account.portfolio'),
    source: resultReferenceSchema,
  })
  .strict()

/** A trusted presentation specification selected by the model or direct lane. */
export const viewSpecSchema = z.discriminatedUnion('view', [
  transactionDetailViewSpecSchema,
  accountPortfolioViewSpecSchema,
])

/** A trusted presentation specification selected by the model or direct lane. */
export type ViewSpec = z.infer<typeof viewSpecSchema>

/** A target owned by the shared workspace while platform focus remains local. */
export const focusTargetSchema = z.discriminatedUnion('area', [
  z.object({ area: z.literal('navigation') }).strict(),
  z
    .object({
      area: z.literal('workspace'),
      artifactId: z.string().min(1).optional(),
    })
    .strict(),
  z.object({ area: z.literal('composer') }).strict(),
])

/** A target owned by the shared workspace while platform focus remains local. */
export type FocusTarget = z.infer<typeof focusTargetSchema>

const workspaceCommandBase = {
  protocolVersion: experienceProtocolVersionSchema,
  type: z.literal('workspace.command'),
}

/** Opens a new artifact tab or updates the artifact with the same id. */
export const openWorkspaceCommandSchema = z
  .object({
    ...workspaceCommandBase,
    command: z.literal('open'),
    artifactId: z.string().min(1),
    title: z.string().min(1),
    view: viewSpecSchema,
    activate: z.boolean(),
  })
  .strict()

/** Replaces an artifact's trusted view while preserving its local identity. */
export const replaceWorkspaceCommandSchema = z
  .object({
    ...workspaceCommandBase,
    command: z.literal('replace'),
    artifactId: z.string().min(1),
    title: z.string().min(1).optional(),
    view: viewSpecSchema,
  })
  .strict()

const workspacePatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    source: resultReferenceSchema.optional(),
  })
  .strict()
  .refine((patch) => patch.title !== undefined || patch.source !== undefined, {
    message: 'A workspace patch must change title or source',
  })

/** Patches safe artifact metadata or its authoritative result reference. */
export const patchWorkspaceCommandSchema = z
  .object({
    ...workspaceCommandBase,
    command: z.literal('patch'),
    artifactId: z.string().min(1),
    patch: workspacePatchSchema,
  })
  .strict()

/** Moves semantic focus without encoding renderer-specific focus mechanics. */
export const focusWorkspaceCommandSchema = z
  .object({
    ...workspaceCommandBase,
    command: z.literal('focus'),
    target: focusTargetSchema,
  })
  .strict()

/** Sets an artifact's pinned state explicitly and idempotently. */
export const pinWorkspaceCommandSchema = z
  .object({
    ...workspaceCommandBase,
    command: z.literal('pin'),
    artifactId: z.string().min(1),
    pinned: z.boolean(),
  })
  .strict()

/** Versioned semantic mutations accepted by the shared workspace reducer. */
export const workspaceCommandSchema = z.discriminatedUnion('command', [
  openWorkspaceCommandSchema,
  replaceWorkspaceCommandSchema,
  patchWorkspaceCommandSchema,
  focusWorkspaceCommandSchema,
  pinWorkspaceCommandSchema,
])

/** Versioned semantic mutation accepted by the shared workspace reducer. */
export type WorkspaceCommand = z.infer<typeof workspaceCommandSchema>

const writeStageEventBase = {
  protocolVersion: experienceProtocolVersionSchema,
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
    protocolVersion: experienceProtocolVersionSchema,
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
    protocolVersion: experienceProtocolVersionSchema,
    type: z.literal('approval.decision'),
    requestId: z.string().min(1),
    state: z.enum(['approved', 'denied']),
    reason: z.string().min(1).optional(),
  })
  .strict()

/** Explicit approval request and decision states carried by the protocol. */
export const approvalEventSchema = z.discriminatedUnion('type', [
  approvalRequestSchema,
  approvalDecisionSchema,
])

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
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
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
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
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
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'approval.decision',
    ...input,
  })
}

/** Any message in the first provisional browser-safe experience spine. */
export const experienceMessageSchema = z.union([
  structuredResultSchema,
  viewSpecSchema,
  workspaceCommandSchema,
  writeStageEventSchema,
  approvalEventSchema,
])

/** Any message in the first provisional browser-safe experience spine. */
export type ExperienceMessage = z.infer<typeof experienceMessageSchema>
