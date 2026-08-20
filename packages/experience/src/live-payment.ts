import { z } from 'zod'

import { uint64JsonSchema } from './algo.js'
import { algorandAddressCandidateSchema } from './classifier.js'
import {
  paymentConfirmationDataSchema,
  paymentDraftDataSchema,
  paymentSignedGroupDataSchema,
  paymentSimulationDataSchema,
  type PaymentDraftData,
} from './payments.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'

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

/** Identifiers a host assigns to one mapped structured result. */
export interface ResultIdentity {
  resultId: string
  toolCallId: string
  network: string
}

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
  /** The tool's declared display hint — the renderer's view cue. */
  display?: string
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
