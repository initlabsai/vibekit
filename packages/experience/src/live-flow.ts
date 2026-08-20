import { addResult, findResultRecord, type ResultStore, type StructuredResult } from './results.js'
import {
  createApprovalRequestForFlow,
  createConfirmEventForRecord,
  createDecisionForFlow,
  createDraftEventForRecord,
  createInspectEventForFlow,
  createSignEventForRecord,
  createSimulateEventForRecord,
  writeFlowReducer,
  type WriteFlowEvent,
  type WriteFlowEventKind,
  type WriteFlowState,
} from './write-flow.js'

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
