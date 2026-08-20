import { z } from 'zod'

import { uint64JsonSchema } from '../core/algo.js'
import { algorandAddressCandidateSchema } from '../core/classifier.js'
import {
  addResult,
  findResultRecord,
  structuredResultSchema,
  type ResultIdentity,
  type ResultStore,
  type StructuredResult,
} from '../core/results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from '../core/version.js'
import {
  createApprovalRequestForFlow,
  createConfirmEventForRecord,
  createDecisionForFlow,
  createDraftEventForRecord,
  createInspectEventForFlow,
  createSignEventForRecord,
  createSimulateEventForRecord,
  paymentConfirmationDataSchema,
  paymentDraftDataSchema,
  paymentSignedGroupDataSchema,
  paymentSimulationDataSchema,
  writeFlowReducer,
  type PaymentDraftData,
  type WriteFlowEvent,
  type WriteFlowEventKind,
  type WriteFlowState,
} from './payment.js'

/** The JSON-safe wire shape a compose-mode write tool returns. */
export const composeWireResultSchema = z.object({
  unsignedGroup: z.array(z.string().min(1)).min(1),
  summary: z.string().min(1),
})

/** The JSON-safe wire subset of simulate_transactions this slice consumes. */
export const simulateWireResultSchema = z.object({
  wouldSucceed: z.boolean(),
  failureMessage: z.string().min(1).optional(),
  simulatedRound: z.number().int().nonnegative(),
  txids: z.array(z.string()),
})

/**
 * Facts a host decodes from the actual unsigned group bytes with algosdk.
 * The bytes are authoritative; these fields must come from them, never from
 * request parameters.
 */
export const decodedPaymentFactsSchema = z
  .object({
    sender: algorandAddressCandidateSchema,
    receiver: algorandAddressCandidateSchema,
    amountMicroAlgos: uint64JsonSchema,
    feeMicroAlgos: uint64JsonSchema,
    note: z.string().min(1).optional(),
    transactionTypes: z.array(z.string().min(1)).min(1),
  })
  .strict()

/** Facts a host decodes from the actual unsigned group bytes. */
export type DecodedPaymentFacts = z.infer<typeof decodedPaymentFactsSchema>

/** Wraps a compose-mode payment result and its decoded facts as a draft record. */
export function buildPaymentDraftRecord(
  identity: ResultIdentity,
  wire: unknown,
  decoded: DecodedPaymentFacts,
): StructuredResult {
  const compose = composeWireResultSchema.parse(wire)
  const facts = decodedPaymentFactsSchema.parse(decoded)
  const data: PaymentDraftData = paymentDraftDataSchema.parse({
    sender: facts.sender,
    receiver: facts.receiver,
    amountMicroAlgos: facts.amountMicroAlgos,
    ...(facts.note === undefined ? {} : { note: facts.note }),
    unsignedGroup: {
      transactions: compose.unsignedGroup,
      summary: compose.summary,
    },
  })
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName: 'send_payment',
    network: identity.network,
    data,
  })
}

/**
 * Wraps a simulate_transactions result as a simulation record. Sender,
 * receiver, amount, and fee come from the decoded draft group — the bytes
 * under approval — and balance effects derive from them with integer math.
 */
export function buildPaymentSimulationRecord(
  identity: ResultIdentity,
  wire: unknown,
  decoded: DecodedPaymentFacts,
): StructuredResult {
  const simulation = simulateWireResultSchema.parse(wire)
  const facts = decodedPaymentFactsSchema.parse(decoded)
  const amount = BigInt(facts.amountMicroAlgos)
  const fee = BigInt(facts.feeMicroAlgos)
  const toJson = (value: bigint): number | string => {
    const absolute = value < 0n ? -value : value
    return absolute <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString()
  }
  const data = paymentSimulationDataSchema.parse({
    wouldSucceed: simulation.wouldSucceed,
    ...(simulation.failureMessage === undefined
      ? {}
      : { failureMessage: simulation.failureMessage }),
    sender: facts.sender,
    receiver: facts.receiver,
    amountMicroAlgos: facts.amountMicroAlgos,
    feeMicroAlgos: facts.feeMicroAlgos,
    group: { size: facts.transactionTypes.length, transactionTypes: facts.transactionTypes },
    effects: [
      { account: facts.sender, deltaMicroAlgos: toJson(-(amount + fee)) },
      { account: facts.receiver, deltaMicroAlgos: toJson(amount) },
    ],
    simulatedRound: simulation.simulatedRound,
  })
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName: 'simulate_transactions',
    network: identity.network,
    data,
  })
}

/** Wraps signed group bytes and their transaction ids as a signed record. */
export function buildPaymentSignedGroupRecord(
  identity: ResultIdentity,
  data: { transactions: string[]; txIds: string[]; signer: string },
): StructuredResult {
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName: 'sign_group',
    network: identity.network,
    data: paymentSignedGroupDataSchema.parse(data),
  })
}

/** Wraps an on-chain confirmation as a confirmation record. */
export function buildPaymentConfirmationRecord(
  identity: ResultIdentity,
  data: { transactionId: string; confirmedRound: number },
): StructuredResult {
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName: 'submit_group',
    network: identity.network,
    data: paymentConfirmationDataSchema.parse(data),
  })
}

/** The tool-result subset of the orchestrator's AgentEvent stream. */
export interface ToolResultEventLike {
  id: string
  toolName: string
  output: unknown
  isError: boolean
  /** The tool's declared view cue, when present. */
  view?: string
}

const toolErrorOutputSchema = z.object({
  error: z.object({ code: z.string().min(1), message: z.string().min(1) }),
})

/**
 * Wraps one orchestrator tool-result event as a versioned structured result.
 * The event's `id` is the tool-call id; the caller supplies the result id and
 * the network the call ran on (a call parameter, not event state).
 */
export function structuredResultFromToolEvent(
  event: ToolResultEventLike,
  identity: { resultId: string; network: string },
): StructuredResult {
  if (event.isError) {
    const parsed = toolErrorOutputSchema.safeParse(event.output)
    return structuredResultSchema.parse({
      protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
      type: 'result',
      state: 'error',
      resultId: identity.resultId,
      toolCallId: event.id,
      toolName: event.toolName,
      network: identity.network,
      error: parsed.success
        ? parsed.data.error
        : { code: 'TOOL_ERROR', message: 'Tool call failed without a structured error' },
    })
  }
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: event.id,
    toolName: event.toolName,
    network: identity.network,
    data: event.output,
  })
}

/** Parameters for composing one unsigned payment draft. */
export interface PaymentDraftParams {
  sender: string
  receiver: string
  amountMicroAlgos: number
  note?: string
}

/**
 * The capability a renderer needs to run the live payment flow. The TUI
 * satisfies it in-process (adding keystore signing behind explicit approval);
 * the browser satisfies the signerless subset with a fetch wrapper over a
 * compose-only server route. Custody appears only through the optional
 * capabilities and never inside this controller.
 */
export interface PaymentFlowHost {
  network: string
  draftPayment(params: PaymentDraftParams): Promise<StructuredResult>
  simulateDraft(draftRecord: StructuredResult): Promise<StructuredResult>
  /** Signs the approved draft group; absent on custody-less hosts. */
  signDraft?(draftRecord: StructuredResult): Promise<StructuredResult>
  /** Submits an already-signed group; absent on hosts that cannot broadcast. */
  submitSigned?(signedRecord: StructuredResult): Promise<StructuredResult>
}

/** Result of one live payment step: new client state, or an explicit refusal. */
export type LivePaymentStepOutcome =
  { ok: true; store: ResultStore; flow: WriteFlowState } | { ok: false; message: string }

/**
 * Result of an auto-advanced run. Progress survives failure: `store` and
 * `flow` always hold the furthest state reached, so a failed step leaves the
 * earlier observable stages intact rather than discarding them.
 */
export interface PaymentFlowRun {
  ok: boolean
  message?: string
  /** True when the host has no signer, so the flow rests at `approved`. */
  pausedForSigner?: boolean
  store: ResultStore
  flow: WriteFlowState | null
}

/**
 * Performs one semantic step of the live payment flow: produce the needed
 * authoritative record through the host, then advance the shared machine with
 * the corresponding protocol event. Signing and confirmation run only when
 * the host carries those capabilities; without them the steps are explicit
 * refusals, never silent skips.
 */
export async function performLivePaymentStep(input: {
  host: PaymentFlowHost
  store: ResultStore
  flow: WriteFlowState | null
  kind: WriteFlowEventKind
  draftParams?: PaymentDraftParams
  newId: (prefix: string) => string
}): Promise<LivePaymentStepOutcome> {
  const { host, flow, kind, newId } = input
  let store = input.store

  const advance = (event: WriteFlowEvent | undefined, state: WriteFlowState | null) => {
    if (!event) return { ok: false as const, message: `No ${kind} event is possible yet` }
    const transition = writeFlowReducer(state, event)
    return transition.ok
      ? { ok: true as const, store, flow: transition.state }
      : { ok: false as const, message: transition.error.message }
  }

  try {
    switch (kind) {
      case 'draft': {
        if (flow !== null) return { ok: false, message: 'A payment flow is already open' }
        if (!input.draftParams) return { ok: false, message: 'Draft parameters are required' }
        const record = await host.draftPayment(input.draftParams)
        store = addResult(store, record)
        return advance(createDraftEventForRecord(newId('flow-live-payment'), record), null)
      }
      case 'simulate': {
        if (!flow) return { ok: false, message: 'No payment flow is open' }
        const draftRecord = findResultRecord(store, flow.draft)
        if (!draftRecord) return { ok: false, message: 'The draft record is missing' }
        const record = await host.simulateDraft(draftRecord)
        store = addResult(store, record)
        return advance(createSimulateEventForRecord(flow, record), flow)
      }
      case 'inspect': {
        if (!flow) return { ok: false, message: 'No payment flow is open' }
        return advance(createInspectEventForFlow(flow), flow)
      }
      case 'request-approval': {
        if (!flow) return { ok: false, message: 'No payment flow is open' }
        return advance(createApprovalRequestForFlow(flow, newId('approval-live-payment')), flow)
      }
      case 'approve': {
        if (!flow) return { ok: false, message: 'No payment flow is open' }
        return advance(createDecisionForFlow(flow, 'approved'), flow)
      }
      case 'deny': {
        if (!flow) return { ok: false, message: 'No payment flow is open' }
        return advance(createDecisionForFlow(flow, 'denied', 'Denied in Explorer review'), flow)
      }
      case 'sign': {
        if (!flow) return { ok: false, message: 'No payment flow is open' }
        if (!host.signDraft) {
          return { ok: false, message: 'This host has no signer — signing is unavailable' }
        }
        if (flow.stage !== 'approved') {
          return { ok: false, message: `Cannot sign from stage ${flow.stage}` }
        }
        const draftRecord = findResultRecord(store, flow.draft)
        if (!draftRecord) return { ok: false, message: 'The draft record is missing' }
        const record = await host.signDraft(draftRecord)
        store = addResult(store, record)
        return advance(createSignEventForRecord(flow, record), flow)
      }
      case 'confirm': {
        if (!flow) return { ok: false, message: 'No payment flow is open' }
        if (!host.submitSigned) {
          return { ok: false, message: 'This host cannot submit — confirmation is unavailable' }
        }
        if (!flow.signed) {
          return { ok: false, message: 'No signed group exists to submit' }
        }
        const signedRecord = findResultRecord(store, flow.signed)
        if (!signedRecord) return { ok: false, message: 'The signed record is missing' }
        const record = await host.submitSigned(signedRecord)
        store = addResult(store, record)
        return advance(createConfirmEventForRecord(flow, record), flow)
      }
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

async function runSteps(input: {
  host: PaymentFlowHost
  store: ResultStore
  flow: WriteFlowState | null
  kinds: readonly WriteFlowEventKind[]
  draftParams?: PaymentDraftParams
  newId: (prefix: string) => string
  onStep?: (store: ResultStore, flow: WriteFlowState) => void
}): Promise<PaymentFlowRun> {
  let store = input.store
  let flow = input.flow
  for (const kind of input.kinds) {
    const outcome = await performLivePaymentStep({
      host: input.host,
      store,
      flow,
      kind,
      draftParams: input.draftParams,
      newId: input.newId,
    })
    if (!outcome.ok) return { ok: false, message: outcome.message, store, flow }
    store = outcome.store
    flow = outcome.flow
    input.onStep?.(store, flow)
  }
  return { ok: true, store, flow }
}

/**
 * Auto-advances a new payment through its mechanical stages — draft,
 * simulate, inspect, approval request — and stops at `awaiting-approval`,
 * the one point that needs a human. Every stage still happens as its own
 * observable protocol event; `onStep` streams each one to the renderer.
 */
export async function startPaymentFlow(input: {
  host: PaymentFlowHost
  store: ResultStore
  draftParams: PaymentDraftParams
  newId: (prefix: string) => string
  onStep?: (store: ResultStore, flow: WriteFlowState) => void
}): Promise<PaymentFlowRun> {
  return runSteps({
    ...input,
    flow: null,
    kinds: ['draft', 'simulate', 'inspect', 'request-approval'],
  })
}

/**
 * Auto-advances an `approved` flow through signing and submission. On a host
 * without a signer the flow rests at `approved` (`pausedForSigner`) — an
 * honest stop, never a fake confirmation.
 */
export async function completeApprovedPaymentFlow(input: {
  host: PaymentFlowHost
  store: ResultStore
  flow: WriteFlowState
  newId: (prefix: string) => string
  onStep?: (store: ResultStore, flow: WriteFlowState) => void
}): Promise<PaymentFlowRun> {
  if (input.flow.stage !== 'approved') {
    return {
      ok: false,
      message: `Cannot sign from stage ${input.flow.stage}`,
      store: input.store,
      flow: input.flow,
    }
  }
  if (!input.host.signDraft) {
    return { ok: true, pausedForSigner: true, store: input.store, flow: input.flow }
  }
  return runSteps({ ...input, kinds: ['sign', 'confirm'] })
}

/**
 * Auto-advances a payment that was drafted elsewhere (for example by the
 * agent calling send_payment in compose mode): registers the draft record,
 * then simulates, inspects, and requests approval — pausing at the same
 * approval card as every other payment.
 */
export async function startPaymentFlowFromDraftRecord(input: {
  host: PaymentFlowHost
  store: ResultStore
  draftRecord: StructuredResult
  newId: (prefix: string) => string
  onStep?: (store: ResultStore, flow: WriteFlowState) => void
}): Promise<PaymentFlowRun> {
  let store: ResultStore
  try {
    store = addResult(input.store, input.draftRecord)
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      store: input.store,
      flow: null,
    }
  }
  const transition = writeFlowReducer(
    null,
    createDraftEventForRecord(input.newId('flow-live-payment'), input.draftRecord),
  )
  if (!transition.ok) {
    return { ok: false, message: transition.error.message, store, flow: null }
  }
  input.onStep?.(store, transition.state)
  return runSteps({
    host: input.host,
    store,
    flow: transition.state,
    kinds: ['simulate', 'inspect', 'request-approval'],
    newId: input.newId,
    onStep: input.onStep,
  })
}
