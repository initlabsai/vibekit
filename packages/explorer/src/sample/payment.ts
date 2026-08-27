import { parseAlgosToMicroAlgos } from '../format.js'
import type { AccountLookupHost } from '../views/account.js'
import type { TransactionLookupHost } from '../views/transaction.js'
import { createFixtureEntityLookup } from './entities.js'
import type { PaymentFlowHost } from '../flows/payment-live.js'
import { createFixtureAccountLookup } from './account.js'
import {
  approvalDecisionSchema,
  approvalRequestSchema,
  writeConfirmEventSchema,
  writeDraftEventSchema,
  writeInspectEventSchema,
  writeSignEventSchema,
  writeSimulateEventSchema,
} from '../core/protocol.js'
import {
  paymentConfirmationDataSchema,
  paymentDraftDataSchema,
  paymentSignedGroupDataSchema,
  paymentSimulationDataSchema,
  type WriteFlowEvent,
  type WriteFlowEventKind,
} from '../flows/payment.js'
import {
  createResultStore,
  type ResultReference,
  type ResultStore,
  type StructuredResult,
} from '../core/results.js'
import { EXPLORER_PROTOCOL_VERSION } from '../core/version.js'
import type { BlockTailTick } from '../live/block-tail.js'
import {
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  transactionFixtureResult,
} from './transaction.js'

/** Opaque flow id of the fixture payment write flow. */
export const PAYMENT_FIXTURE_FLOW_ID = 'flow-fixture-payment-001'

/** Tool-call id of the composing call the fixture flow correlates approval to. */
export const PAYMENT_FIXTURE_TOOL_CALL_ID = 'tool-call-fixture-payment-draft-001'

/** Result id of the fixture unsigned payment draft. */
export const PAYMENT_FIXTURE_DRAFT_RESULT_ID = 'result-fixture-payment-draft-001'

/** Result id of the fixture payment simulation, the reviewed inspection record. */
export const PAYMENT_FIXTURE_SIMULATION_RESULT_ID = 'result-fixture-payment-simulation-001'

/** Result id of the fixture payment confirmation. */
export const PAYMENT_FIXTURE_CONFIRMATION_RESULT_ID = 'result-fixture-payment-confirmation-001'

/** Request id correlating the fixture approval request and decision. */
export const PAYMENT_FIXTURE_APPROVAL_REQUEST_ID = 'approval-fixture-payment-001'

/** Fixture payment amount in microALGOs. */
export const PAYMENT_FIXTURE_AMOUNT_MICROALGOS = 250000

/** Fixture payment fee in microALGOs. */
export const PAYMENT_FIXTURE_FEE_MICROALGOS = 1000

/**
 * The real transaction id of the fixture payment — signed by the keystore
 * daemon and confirmed on localnet (round 22) during the 2026-08-19 field
 * run. It is the txId of the unsigned bytes below.
 */
export const PAYMENT_FIXTURE_TRANSACTION_ID = 'M6ZESI2KYMT7W7XPAXK3EA45RTJKYFD2ECPRYSR2MPZDWXUWAVXA'

/**
 * A real unsigned payment transaction: send_payment composed in compose mode
 * against localnet on 2026-08-19 (250000 microALGO, fee 1000, note
 * "Explorer fixture payment"). The bytes are the fixture's ground truth; the
 * decode contract test proves the draft facts below match them.
 */
export const PAYMENT_FIXTURE_UNSIGNED_TRANSACTION =
  'iqNhbXTOAAPQkKNmZWXNA+iiZnYVo2dlbqxkb2NrZXJuZXQtdjGiZ2jEIDRSF9ew9NmLHRa+ULWIZ8GqxKO/Gu7Xe7DYRFFb9QyQomx2zQP9pG5vdGXEGEV4cGxvcmVyIGZpeHR1cmUgcGF5bWVudKNyY3bEIF6YZnqjef52E0irFLpgSz9PaWcfjBDB9oIUytTxnBiDo3NuZMQgs+PXcPbm7M3HcUGJ+8+wPucmkjyuEoMiehGlqSr/frGkdHlwZaNwYXk='

/**
 * The same transaction signed by the keystore daemon (raw ed25519 over the
 * daemon socket) — the signature the chain accepted in round 22.
 */
export const PAYMENT_FIXTURE_SIGNED_TRANSACTION =
  'gqNzaWfEQKylLIb3qUiuHrP4qwExEiueoW1+ER0BTwLjh6uwae6+UVYL+adJK8VkhYi/AS1OXKcCDoVkoEmk94VYlEF3jQmjdHhuiqNhbXTOAAPQkKNmZWXNA+iiZnYVo2dlbqxkb2NrZXJuZXQtdjGiZ2jEIDRSF9ew9NmLHRa+ULWIZ8GqxKO/Gu7Xe7DYRFFb9QyQomx2zQP9pG5vdGXEGEV4cGxvcmVyIGZpeHR1cmUgcGF5bWVudKNyY3bEIF6YZnqjef52E0irFLpgSz9PaWcfjBDB9oIUytTxnBiDo3NuZMQgs+PXcPbm7M3HcUGJ+8+wPucmkjyuEoMiehGlqSr/frGkdHlwZaNwYXk='

/** Result id of the fixture signed group. */
export const PAYMENT_FIXTURE_SIGNED_RESULT_ID = 'result-fixture-payment-signed-001'

/** The compose summary recorded with the fixture group. */
export const PAYMENT_FIXTURE_GROUP_SUMMARY = `[0] pay 250000 microALGO ${FIXTURE_SENDER} → ${FIXTURE_RECEIVER}`

const draftData = paymentDraftDataSchema.parse({
  sender: FIXTURE_SENDER,
  receiver: FIXTURE_RECEIVER,
  amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  note: 'Explorer fixture payment',
  feeMicroAlgos: PAYMENT_FIXTURE_FEE_MICROALGOS,
  transactionTypes: ['pay'],
  unsignedGroup: {
    transactions: [PAYMENT_FIXTURE_UNSIGNED_TRANSACTION],
    summary: PAYMENT_FIXTURE_GROUP_SUMMARY,
  },
  graphTransactions: [
    {
      type: 'pay',
      sender: FIXTURE_SENDER,
      receiver: FIXTURE_RECEIVER,
      paymentAmountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
      feeMicroAlgos: PAYMENT_FIXTURE_FEE_MICROALGOS,
      note: 'Explorer fixture payment',
    },
  ],
})

const simulationData = paymentSimulationDataSchema.parse({
  wouldSucceed: true,
  sender: FIXTURE_SENDER,
  receiver: FIXTURE_RECEIVER,
  amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  feeMicroAlgos: PAYMENT_FIXTURE_FEE_MICROALGOS,
  group: { size: 1, transactionTypes: ['pay'] },
  effects: [
    { account: FIXTURE_SENDER, deltaMicroAlgos: -251000 },
    { account: FIXTURE_RECEIVER, deltaMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS },
  ],
  simulatedRound: 21,
})

const signedGroupData = paymentSignedGroupDataSchema.parse({
  transactions: [PAYMENT_FIXTURE_SIGNED_TRANSACTION],
  txIds: [PAYMENT_FIXTURE_TRANSACTION_ID],
  signer: FIXTURE_SENDER,
})

const confirmationData = paymentConfirmationDataSchema.parse({
  transactionId: PAYMENT_FIXTURE_TRANSACTION_ID,
  confirmedRound: 22,
})

/**
 * The four fixture payment results — unsigned draft, simulation, signed
 * group, and confirmation — all recorded from one real localnet flow.
 */
export const paymentFixtureResults: readonly StructuredResult[] = createResultStore([
  {
    protocolVersion: EXPLORER_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: PAYMENT_FIXTURE_DRAFT_RESULT_ID,
    toolCallId: PAYMENT_FIXTURE_TOOL_CALL_ID,
    toolName: 'send_payment',
    network: 'localnet',
    data: draftData,
  },
  {
    protocolVersion: EXPLORER_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: PAYMENT_FIXTURE_SIMULATION_RESULT_ID,
    toolCallId: 'tool-call-fixture-payment-simulation-001',
    toolName: 'simulate_transactions',
    network: 'localnet',
    data: simulationData,
  },
  {
    protocolVersion: EXPLORER_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: PAYMENT_FIXTURE_SIGNED_RESULT_ID,
    toolCallId: 'tool-call-fixture-payment-signed-001',
    toolName: 'sign_group',
    network: 'localnet',
    data: signedGroupData,
  },
  {
    protocolVersion: EXPLORER_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: PAYMENT_FIXTURE_CONFIRMATION_RESULT_ID,
    toolCallId: 'tool-call-fixture-payment-confirmation-001',
    toolName: 'submit_group',
    network: 'localnet',
    data: confirmationData,
  },
])

/** Creates a fresh immutable result store containing only the payment fixtures. */
export function createPaymentFixtureResultStore(): ResultStore {
  return createResultStore(paymentFixtureResults)
}

/** Creates the full fixture store both apps start from: transaction plus payment results. */
export function createExplorerFixtureResultStore(): ResultStore {
  return createResultStore([transactionFixtureResult, ...paymentFixtureResults])
}

function reference(id: string): ResultReference {
  return { source: 'result', id }
}

/**
 * A PaymentFlowHost backed by the recorded fixture flow, so the apps run the
 * exact same controller with or without a live chain. Each call returns a
 * freshly identified copy of the recorded record (the store rejects duplicate
 * ids), with the recorded data — including the real signed bytes and the real
 * round-22 confirmation — unchanged.
 */
export function createFixturePaymentHost(): PaymentFlowHost &
  AccountLookupHost &
  TransactionLookupHost &
  ReturnType<typeof createFixtureEntityLookup> & {
    statusRound(): Promise<{ lastRound: number }>
    waitAfterBlock(round: number): Promise<{ lastRound: number }>
    readBlockTick(round: number): Promise<BlockTailTick>
  } {
  let counter = 0
  const reidentify = (record: StructuredResult): StructuredResult => {
    counter += 1
    return {
      ...record,
      resultId: `${record.resultId}-copy-${counter}`,
      toolCallId: `${record.toolCallId}-copy-${counter}`,
    }
  }
  const recordById = (resultId: string): StructuredResult => {
    const record = paymentFixtureResults.find((candidate) => candidate.resultId === resultId)
    if (!record) throw new Error(`Missing fixture record ${resultId}`)
    return record
  }
  return {
    ...createFixtureAccountLookup(),
    ...createFixtureEntityLookup(),
    async lookupTransaction(txid: string): Promise<StructuredResult> {
      if (txid !== FIXTURE_TRANSACTION_ID) {
        throw new Error('Only the sample transaction is available while localnet is offline')
      }
      return reidentify(transactionFixtureResult)
    },
    async lookupTransactionGroup(groupId: string): Promise<StructuredResult> {
      throw new Error(
        `No sample transaction group ${groupId} (connect localnet or paste a live group ID)`,
      )
    },
    network: 'localnet',
    // The sample flow always replays the recorded 0.25 ALGO payment.
    async draftPayment() {
      return reidentify(recordById(PAYMENT_FIXTURE_DRAFT_RESULT_ID))
    },
    async simulateDraft() {
      return reidentify(recordById(PAYMENT_FIXTURE_SIMULATION_RESULT_ID))
    },
    async signDraft() {
      return reidentify(recordById(PAYMENT_FIXTURE_SIGNED_RESULT_ID))
    },
    async submitSigned() {
      return reidentify(recordById(PAYMENT_FIXTURE_CONFIRMATION_RESULT_ID))
    },
    async statusRound() {
      throw new Error('sample data has no block tail')
    },
    async waitAfterBlock() {
      throw new Error('sample data has no block tail')
    },
    async readBlockTick() {
      throw new Error('sample data has no block tail')
    },
  }
}

/**
 * Creates the protocol event for one semantic step of the fixture payment
 * flow. Every event carries only result references; the machine and both
 * apps read authoritative facts from the structured results.
 */
export function createPaymentFixtureEvent(kind: WriteFlowEventKind): WriteFlowEvent {
  switch (kind) {
    case 'draft':
      return writeDraftEventSchema.parse({
        protocolVersion: EXPLORER_PROTOCOL_VERSION,
        type: 'write.stage',
        stage: 'draft',
        flowId: PAYMENT_FIXTURE_FLOW_ID,
        toolCallId: PAYMENT_FIXTURE_TOOL_CALL_ID,
        draft: reference(PAYMENT_FIXTURE_DRAFT_RESULT_ID),
      })
    case 'simulate':
      return writeSimulateEventSchema.parse({
        protocolVersion: EXPLORER_PROTOCOL_VERSION,
        type: 'write.stage',
        stage: 'simulate',
        flowId: PAYMENT_FIXTURE_FLOW_ID,
        simulation: reference(PAYMENT_FIXTURE_SIMULATION_RESULT_ID),
      })
    case 'inspect':
      // Inspection presents the simulation record: the one authoritative
      // source of the reviewed sender, amount, fee, and effects.
      return writeInspectEventSchema.parse({
        protocolVersion: EXPLORER_PROTOCOL_VERSION,
        type: 'write.stage',
        stage: 'inspect',
        flowId: PAYMENT_FIXTURE_FLOW_ID,
        inspection: reference(PAYMENT_FIXTURE_SIMULATION_RESULT_ID),
      })
    case 'request-approval':
      return approvalRequestSchema.parse({
        protocolVersion: EXPLORER_PROTOCOL_VERSION,
        type: 'approval.request',
        requestId: PAYMENT_FIXTURE_APPROVAL_REQUEST_ID,
        state: 'pending',
        toolCallId: PAYMENT_FIXTURE_TOOL_CALL_ID,
        inspection: reference(PAYMENT_FIXTURE_SIMULATION_RESULT_ID),
      })
    case 'approve':
      return approvalDecisionSchema.parse({
        protocolVersion: EXPLORER_PROTOCOL_VERSION,
        type: 'approval.decision',
        requestId: PAYMENT_FIXTURE_APPROVAL_REQUEST_ID,
        state: 'approved',
      })
    case 'deny':
      return approvalDecisionSchema.parse({
        protocolVersion: EXPLORER_PROTOCOL_VERSION,
        type: 'approval.decision',
        requestId: PAYMENT_FIXTURE_APPROVAL_REQUEST_ID,
        state: 'denied',
        reason: 'Denied in Explorer review',
      })
    case 'sign':
      return writeSignEventSchema.parse({
        protocolVersion: EXPLORER_PROTOCOL_VERSION,
        type: 'write.stage',
        stage: 'sign',
        flowId: PAYMENT_FIXTURE_FLOW_ID,
        signed: reference(PAYMENT_FIXTURE_SIGNED_RESULT_ID),
      })
    case 'confirm':
      return writeConfirmEventSchema.parse({
        protocolVersion: EXPLORER_PROTOCOL_VERSION,
        type: 'write.stage',
        stage: 'confirm',
        flowId: PAYMENT_FIXTURE_FLOW_ID,
        confirmation: reference(PAYMENT_FIXTURE_CONFIRMATION_RESULT_ID),
      })
  }
}

/**
 * Parses the deterministic composer command that begins a payment: `pay`,
 * `draft payment`, or `pay <algos>` with up to six decimal places. The
 * default amount matches the fixture payment.
 */
export function parsePaymentComposerCommand(
  raw: string,
): { amountMicroAlgos: number; to?: string } | undefined {
  const input = raw.trim()
  if (/^(pay|draft payment)$/i.test(input)) {
    return { amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS }
  }
  // `pay 0.5 to alice` — the receiver is a keystore label or an address; hosts resolve it.
  const withAmount = /^pay\s+(\S+)(?:\s+to\s+(\S+))?$/i.exec(input)
  if (!withAmount) return undefined
  const amountMicroAlgos = parseAlgosToMicroAlgos(withAmount[1]!)
  if (amountMicroAlgos === undefined || amountMicroAlgos <= 0) return undefined
  return withAmount[2] ? { amountMicroAlgos, to: withAmount[2] } : { amountMicroAlgos }
}
