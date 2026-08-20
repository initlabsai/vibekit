import { describe, expect, test } from 'bun:test'

import {
  buildTransactionDetailRecord,
  createFixturePaymentHost,
  createFixtureResultStore,
  createPaymentFlowViewModel,
  createTransactionDetailViewModel,
  bridgeToolResult,
  paymentComposeFromToolResult,
  PAYMENT_FIXTURE_TRANSACTION_ID,
  recordForToolResult,
  startPaymentFlowFromDraftRecord,
  type ToolResultEventLike,
} from '../src/index.js'
import { draftRecordFromComposeWire } from '../src/live/index.js'
import recorded from './recorded/localnet-payment.json'

let counter = 0
const newId = (prefix: string) => `${prefix}-${++counter}`
const identity = () => ({
  resultId: newId('result-agent'),
  toolCallId: newId('tool-call-agent'),
  network: 'localnet',
})

/** The real lookup_transaction wire recorded from localnet for the fixture payment. */
const TXN_WIRE = {
  id: PAYMENT_FIXTURE_TRANSACTION_ID,
  type: 'pay',
  sender: recorded.request.sender,
  feeMicroAlgos: 1000,
  confirmedRound: 22,
  roundTime: 1787169189,
  paymentAmountMicroAlgos: 250000,
  receiver: recorded.request.receiver,
  note: 'Explorer fixture payment',
}

describe('agent lane result bridge', () => {
  test('the declared view cue selects the trusted view — not the tool name', () => {
    // A third-party tool: unknown name, declared trusted view, compatible wire.
    const event: ToolResultEventLike = {
      id: 'call-1',
      toolName: 'my_custom_lookup',
      view: 'transaction.detail',
      output: TXN_WIRE,
      isError: false,
    }
    const bridged = bridgeToolResult(event, identity())
    expect(bridged.view).toBe('transaction.detail')
    expect(bridged.record).toMatchObject({
      state: 'success',
      toolName: 'my_custom_lookup',
      data: { paymentAmountMicroAlgos: 250000, feeMicroAlgos: 1000, status: 'confirmed' },
    })

    const store = [...createFixtureResultStore(), bridged.record]
    const derived = createTransactionDetailViewModel(store, {
      protocolVersion: '0.1.0-provisional',
      type: 'view',
      view: 'transaction.detail',
      source: { source: 'result', id: bridged.record.resultId },
    })
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.id).toBe(PAYMENT_FIXTURE_TRANSACTION_ID)
    expect(derived.model.note).toBe('Explorer fixture payment')
  })

  test('no declared view means a raw record, even for a first-party tool name', () => {
    const event: ToolResultEventLike = {
      id: 'call-1b',
      toolName: 'lookup_transaction',
      output: TXN_WIRE,
      isError: false,
    }
    expect(bridgeToolResult(event, identity()).view).toBeUndefined()
  })

  test('unknown tools fall back to raw records with no view', () => {
    const event: ToolResultEventLike = {
      id: 'call-2',
      toolName: 'get_network_status',
      output: { round: 27 },
      isError: false,
    }
    const bridged = bridgeToolResult(event, identity())
    expect(bridged.record).toMatchObject({ state: 'success', data: { round: 27 } })
    expect(bridged.view).toBeUndefined()
  })

  test('a malformed wire keeps the raw record instead of dropping it', () => {
    const event: ToolResultEventLike = {
      id: 'call-3',
      toolName: 'lookup_transaction',
      view: 'transaction.detail',
      output: { unexpected: true },
      isError: false,
    }
    const bridged = bridgeToolResult(event, identity())
    expect(bridged.record).toMatchObject({ state: 'success', data: { unexpected: true } })
    expect(bridged.view).toBeUndefined()
  })

  test('tool errors become failed records', () => {
    const event: ToolResultEventLike = {
      id: 'call-4',
      toolName: 'lookup_transaction',
      output: { error: { code: 'NOT_FOUND', message: 'no transaction found' } },
      isError: true,
    }
    const bridged = bridgeToolResult(event, identity())
    expect(bridged.record).toMatchObject({ state: 'error', error: { code: 'NOT_FOUND' } })
    expect(bridged.view).toBeUndefined()
  })

  test('an agent-composed payment is detected and routed into the approval flow', async () => {
    const event: ToolResultEventLike = {
      id: 'call-5',
      toolName: 'send_payment',
      output: recorded.compose,
      isError: false,
    }
    const compose = paymentComposeFromToolResult(event)
    expect(compose?.unsignedGroup).toEqual(recorded.compose.unsignedGroup)

    const draftRecord = draftRecordFromComposeWire(identity(), compose)
    const run = await startPaymentFlowFromDraftRecord({
      host: createFixturePaymentHost(),
      store: createFixtureResultStore(),
      draftRecord,
      newId,
    })
    if (!run.ok || !run.flow) throw new Error(run.message)
    expect(run.flow.stage).toBe('awaiting-approval')

    const derived = createPaymentFlowViewModel(run.store, run.flow)
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.amountMicroAlgos).toBe(250000)
    expect(derived.model.unsignedGroup.transactions).toEqual(recorded.compose.unsignedGroup)
  })

  test('non-payment results never trigger the payment interception', () => {
    expect(
      paymentComposeFromToolResult({
        id: 'call-6',
        toolName: 'lookup_transaction',
        output: recorded.compose,
        isError: false,
      }),
    ).toBeUndefined()
    expect(
      paymentComposeFromToolResult({
        id: 'call-7',
        toolName: 'send_payment',
        output: { error: { code: 'DENIED', message: 'denied' } },
        isError: true,
      }),
    ).toBeUndefined()
  })
})
