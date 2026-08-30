/**
 * The action host side: record builders for each stage, the host
 * capability an app provides, and the controller that walks a flow through
 * its stages. Any composed group runs here — payments, app calls, deploys.
 */
import { z } from 'zod'

import { writeIntentSchema } from '../core/schemas.js'
import { viewDataSchemas } from '../tools/views.js'
import { createApprovalDecisionEvent, createApprovalRequestEvent, createWriteStageEvent } from './protocol.js'
import {
  addResult,
  findResultRecord,
  record,
  type ResultIdentity,
  type ResultStore,
  type StructuredResult,
} from './records.js'
import { algorandAddressCandidateSchema, uint64JsonSchema } from './schemas.js'
import {
  confirmationDataSchema,
  writeDraftDataSchema,
  signedGroupDataSchema,
  writeSimulationDataSchema,
  actionReducer,
  type WriteDraftData,
  type ActionEvent,
  type ActionEventKind,
  type ActionState,
} from './reducer.js'

/** The JSON-safe wire shape a compose-mode action returns. */
export const composeWireResultSchema = z.object({
  unsignedGroup: z.array(z.string().min(1)).min(1),
  summary: z.string().min(1),
  presigned: z.array(z.string().min(1).nullable()).optional(),
  intent: writeIntentSchema.optional(),
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
 * request parameters. Receiver/amount are set when the group is a single pay.
 */
export const decodedGroupFactsSchema = z
  .object({
    sender: algorandAddressCandidateSchema,
    receiver: algorandAddressCandidateSchema.optional(),
    amountMicroAlgos: uint64JsonSchema.optional(),
    feeMicroAlgos: uint64JsonSchema,
    note: z.string().min(1).optional(),
    transactionTypes: z.array(z.string().min(1)).min(1),
    graphTransactions: z.array(viewDataSchemas['transaction.detail']).min(1).optional(),
  })
  .strict()

/** Facts a host decodes from the actual unsigned group bytes. */
export type DecodedGroupFacts = z.infer<typeof decodedGroupFactsSchema>

function algoEffectsFromFacts(
  facts: DecodedGroupFacts,
  toJson: (value: bigint) => number | string,
): Array<{ account: string; deltaMicroAlgos: number | string }> {
  const byAccount = new Map<string, bigint>()
  const add = (account: string, delta: bigint) => {
    byAccount.set(account, (byAccount.get(account) ?? 0n) + delta)
  }
  if (facts.graphTransactions && facts.graphTransactions.length > 0) {
    for (const txn of facts.graphTransactions) {
      add(txn.sender, -BigInt(txn.feeMicroAlgos))
      if (
        txn.type === 'pay' &&
        txn.receiver !== undefined &&
        txn.paymentAmountMicroAlgos !== undefined
      ) {
        const amount = BigInt(txn.paymentAmountMicroAlgos)
        add(txn.sender, -amount)
        add(txn.receiver, amount)
      }
    }
  } else if (facts.amountMicroAlgos !== undefined && facts.receiver !== undefined) {
    const amount = BigInt(facts.amountMicroAlgos)
    const fee = BigInt(facts.feeMicroAlgos)
    add(facts.sender, -(amount + fee))
    add(facts.receiver, amount)
  } else {
    add(facts.sender, -BigInt(facts.feeMicroAlgos))
  }
  return [...byAccount.entries()].map(([account, delta]) => ({
    account,
    deltaMicroAlgos: toJson(delta),
  }))
}

/** Wraps a compose-mode payment result and its decoded facts as a draft record. */
export function buildDraftRecord(
  identity: ResultIdentity,
  wire: unknown,
  decoded: DecodedGroupFacts,
  toolName = 'send_payment',
): StructuredResult {
  const compose = composeWireResultSchema.parse(wire)
  const facts = decodedGroupFactsSchema.parse(decoded)
  const data: WriteDraftData = writeDraftDataSchema.parse({
    sender: facts.sender,
    ...(facts.receiver === undefined ? {} : { receiver: facts.receiver }),
    ...(facts.amountMicroAlgos === undefined ? {} : { amountMicroAlgos: facts.amountMicroAlgos }),
    ...(facts.note === undefined ? {} : { note: facts.note }),
    feeMicroAlgos: facts.feeMicroAlgos,
    transactionTypes: facts.transactionTypes,
    unsignedGroup: {
      transactions: compose.unsignedGroup,
      summary: compose.summary,
    },
    ...(facts.graphTransactions === undefined
      ? {}
      : { graphTransactions: facts.graphTransactions }),
    ...(compose.presigned === undefined ? {} : { presigned: compose.presigned }),
    ...(compose.intent === undefined ? {} : { intent: compose.intent }),
  })
  if (compose.presigned && compose.presigned.length !== compose.unsignedGroup.length) {
    throw new Error('presigned must name every index of the group')
  }
  return record(identity, toolName, data)
}

/**
 * Wraps a simulate_transactions result as a simulation record. Sender, fee,
 * and optional payment facts come from the decoded draft group — the bytes
 * under approval — and ALGO balance effects derive from them with integer math.
 */
export function buildSimulationRecord(
  identity: ResultIdentity,
  wire: unknown,
  decoded: DecodedGroupFacts,
): StructuredResult {
  const simulation = simulateWireResultSchema.parse(wire)
  const facts = decodedGroupFactsSchema.parse(decoded)
  const toJson = (value: bigint): number | string => {
    const absolute = value < 0n ? -value : value
    return absolute <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString()
  }
  const effects = algoEffectsFromFacts(facts, toJson)
  const data = writeSimulationDataSchema.parse({
    wouldSucceed: simulation.wouldSucceed,
    ...(simulation.failureMessage === undefined
      ? {}
      : { failureMessage: simulation.failureMessage }),
    sender: facts.sender,
    ...(facts.receiver === undefined ? {} : { receiver: facts.receiver }),
    ...(facts.amountMicroAlgos === undefined ? {} : { amountMicroAlgos: facts.amountMicroAlgos }),
    feeMicroAlgos: facts.feeMicroAlgos,
    group: { size: facts.transactionTypes.length, transactionTypes: facts.transactionTypes },
    effects,
    simulatedRound: simulation.simulatedRound,
  })
  return record(identity, 'simulate_transactions', data)
}

/** Wraps signed group bytes and their transaction ids as a signed record. */
export function buildSignedGroupRecord(
  identity: ResultIdentity,
  data: { transactions: string[]; txIds: string[]; signer: string },
): StructuredResult {
  return record(identity, 'sign_group', signedGroupDataSchema.parse(data))
}

/** Wraps an on-chain confirmation as a confirmation record. */
export function buildConfirmationRecord(
  identity: ResultIdentity,
  data: { transactionId: string; confirmedRound: number },
): StructuredResult {
  return record(identity, 'submit_group', confirmationDataSchema.parse(data))
}

/** What to draft: an action tool by name and its arguments. */
export interface ActionDraft {
  toolName: string
  args: Record<string, unknown>
}

/**
 * The capability an app needs to run an action. The TUI satisfies it
 * in-process (adding keystore signing behind explicit approval); the browser
 * satisfies the signerless subset with a fetch wrapper over a compose-only
 * server route. Custody appears only through the optional capabilities and
 * never inside this controller.
 */
export interface ActionHost {
  network: string
  /** Runs an action tool in compose mode and wraps the unsigned group it returns as a draft record. */
  draft(toolName: string, args: Record<string, unknown>): Promise<StructuredResult>
  simulateDraft(draftRecord: StructuredResult): Promise<StructuredResult>
  /** Signs the approved draft group; absent on custody-less hosts. */
  signDraft?(draftRecord: StructuredResult): Promise<StructuredResult>
  /** Submits an already-signed group; absent on hosts that cannot broadcast. */
  submitSigned?(signedRecord: StructuredResult): Promise<StructuredResult>
}

/** Result of one action step: new client state, or an explicit refusal. */
export type ActionStepOutcome =
  { ok: true; store: ResultStore; flow: ActionState } | { ok: false; message: string }

/**
 * Result of an auto-advanced run. Progress survives failure: `store` and
 * `flow` always hold the furthest state reached, so a failed step leaves the
 * earlier observable stages intact rather than discarding them.
 */
export interface ActionRun {
  ok: boolean
  message?: string
  /** True when the host has no signer, so the flow rests at `approved`. */
  pausedForSigner?: boolean
  store: ResultStore
  flow: ActionState | null
}

function resultRef(record: StructuredResult): { source: 'result'; id: string } {
  return { source: 'result', id: record.resultId }
}

/** The draft event carries the record's identifiers; later approvals correlate on its tool-call id. */
function draftEventFor(flowId: string, record: StructuredResult): ActionEvent {
  return createWriteStageEvent({
    stage: 'draft',
    flowId,
    toolCallId: record.toolCallId,
    draft: resultRef(record),
  })
}

/**
 * Performs one semantic step of an action: produce the needed
 * authoritative record through the host, then advance the shared machine with
 * the corresponding protocol event. Signing and confirmation run only when
 * the host carries those capabilities; without them the steps are explicit
 * refusals, never silent skips.
 */
export async function performActionStep(input: {
  host: ActionHost
  store: ResultStore
  flow: ActionState | null
  kind: ActionEventKind
  draft?: ActionDraft
  newId: (prefix: string) => string
}): Promise<ActionStepOutcome> {
  const { host, flow, kind, newId } = input
  let store = input.store

  const advance = (event: ActionEvent | undefined, state: ActionState | null) => {
    if (!event) return { ok: false as const, message: `No ${kind} event is possible yet` }
    const transition = actionReducer(state, event)
    return transition.ok
      ? { ok: true as const, store, flow: transition.state }
      : { ok: false as const, message: transition.error.message }
  }

  try {
    switch (kind) {
      case 'draft': {
        if (flow !== null) return { ok: false, message: 'An action is already open' }
        if (!input.draft) return { ok: false, message: 'A draft (tool name and arguments) is required' }
        const record = await host.draft(input.draft.toolName, input.draft.args)
        store = addResult(store, record)
        return advance(draftEventFor(newId('action'), record), null)
      }
      case 'simulate': {
        if (!flow) return { ok: false, message: 'No action is open' }
        const draftRecord = findResultRecord(store, flow.draft)
        if (!draftRecord) return { ok: false, message: 'The draft record is missing' }
        const record = await host.simulateDraft(draftRecord)
        store = addResult(store, record)
        return advance(
          createWriteStageEvent({
            stage: 'simulate',
            flowId: flow.flowId,
            simulation: resultRef(record),
          }),
          flow,
        )
      }
      case 'inspect': {
        if (!flow) return { ok: false, message: 'No action is open' }
        // Inspection reviews exactly the flow's simulation; before one exists there is no event.
        return advance(
          flow.simulation &&
            createWriteStageEvent({
              stage: 'inspect',
              flowId: flow.flowId,
              inspection: flow.simulation,
            }),
          flow,
        )
      }
      case 'request-approval': {
        if (!flow) return { ok: false, message: 'No action is open' }
        // The request covers exactly the inspected reference and tool-call id the machine enforces.
        return advance(
          flow.inspection &&
            createApprovalRequestEvent({
              requestId: newId('approval-live-payment'),
              toolCallId: flow.toolCallId,
              inspection: flow.inspection,
            }),
          flow,
        )
      }
      case 'approve': {
        if (!flow) return { ok: false, message: 'No action is open' }
        return advance(
          flow.approvalRequest &&
            createApprovalDecisionEvent({
              requestId: flow.approvalRequest.requestId,
              state: 'approved',
            }),
          flow,
        )
      }
      case 'deny': {
        if (!flow) return { ok: false, message: 'No action is open' }
        return advance(
          flow.approvalRequest &&
            createApprovalDecisionEvent({
              requestId: flow.approvalRequest.requestId,
              state: 'denied',
              reason: 'Denied in Explorer review',
            }),
          flow,
        )
      }
      case 'sign': {
        if (!flow) return { ok: false, message: 'No action is open' }
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
        return advance(
          createWriteStageEvent({ stage: 'sign', flowId: flow.flowId, signed: resultRef(record) }),
          flow,
        )
      }
      case 'confirm': {
        if (!flow) return { ok: false, message: 'No action is open' }
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
        return advance(
          createWriteStageEvent({
            stage: 'confirm',
            flowId: flow.flowId,
            confirmation: resultRef(record),
          }),
          flow,
        )
      }
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

async function runSteps(input: {
  host: ActionHost
  store: ResultStore
  flow: ActionState | null
  kinds: readonly ActionEventKind[]
  draft?: ActionDraft
  newId: (prefix: string) => string
  onStep?: (store: ResultStore, flow: ActionState) => void
}): Promise<ActionRun> {
  let store = input.store
  let flow = input.flow
  for (const kind of input.kinds) {
    const outcome = await performActionStep({
      host: input.host,
      store,
      flow,
      kind,
      draft: input.draft,
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
 * Auto-advances a new action through its mechanical stages — draft,
 * simulate, inspect, approval request — and stops at `awaiting-approval`,
 * the one point that needs a human. Every stage still happens as its own
 * observable protocol event; `onStep` streams each one to the renderer.
 */
export async function startAction(input: {
  host: ActionHost
  store: ResultStore
  draft: ActionDraft
  newId: (prefix: string) => string
  onStep?: (store: ResultStore, flow: ActionState) => void
}): Promise<ActionRun> {
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
export async function submitAction(input: {
  host: ActionHost
  store: ResultStore
  flow: ActionState
  newId: (prefix: string) => string
  onStep?: (store: ResultStore, flow: ActionState) => void
}): Promise<ActionRun> {
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
 * Auto-advances an action that was drafted elsewhere (for example by the
 * agent calling send_payment in compose mode): registers the draft record,
 * then simulates, inspects, and requests approval — pausing at the same
 * approval card as every other action.
 */
export async function startActionFromDraft(input: {
  host: ActionHost
  store: ResultStore
  draftRecord: StructuredResult
  newId: (prefix: string) => string
  onStep?: (store: ResultStore, flow: ActionState) => void
}): Promise<ActionRun> {
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
  const transition = actionReducer(
    null,
    draftEventFor(input.newId('action'), input.draftRecord),
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
