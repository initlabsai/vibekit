import { describe, expect, test } from 'bun:test'

import {
  algorandTransactionIdSchema,
  createExplorerFixtureResultStore,
  createPaymentFixtureEvent,
  createPaymentFixtureResultStore,
  createPaymentFlowViewModel,
  createResultStore,
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  parsePaymentComposerCommand,
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  PAYMENT_FIXTURE_APPROVAL_REQUEST_ID,
  PAYMENT_FIXTURE_FEE_MICROALGOS,
  PAYMENT_FIXTURE_GROUP_SUMMARY,
  PAYMENT_FIXTURE_SIMULATION_RESULT_ID,
  PAYMENT_FIXTURE_SIGNED_TRANSACTION,
  PAYMENT_FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_UNSIGNED_TRANSACTION,
  paymentFixtureResults,
  paymentSimulationDataSchema,
  writeFlowEventKinds,
  writeFlowEventSchema,
  writeFlowReducer,
  type StructuredResult,
  type WriteFlowEventKind,
  type WriteFlowState,
} from '../src/index.js'

function collectLeaves(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(collectLeaves)
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(collectLeaves)
  }
  return [value]
}

function advance(state: WriteFlowState | null, kind: WriteFlowEventKind): WriteFlowState {
  const transition = writeFlowReducer(state, createPaymentFixtureEvent(kind))
  if (!transition.ok) throw new Error(`Expected ${kind} to advance: ${transition.error.message}`)
  return transition.state
}

const HAPPY_PATH = [
  'draft',
  'simulate',
  'inspect',
  'request-approval',
  'approve',
  'sign',
  'confirm',
] as const

describe('fixture-backed payment write flow', () => {
  test('fixture events validate as versioned protocol messages', () => {
    for (const kind of writeFlowEventKinds) {
      const event = createPaymentFixtureEvent(kind)
      expect(writeFlowEventSchema.parse(event).protocolVersion).toBe('0.1.0-provisional')
    }
  })

  test('events and flow states carry references, never authoritative values', () => {
    let state: WriteFlowState | null = null
    for (const kind of HAPPY_PATH) {
      const leavesOfEvent = collectLeaves(createPaymentFixtureEvent(kind))
      state = advance(state, kind)
      for (const leaves of [leavesOfEvent, collectLeaves(state)]) {
        expect(leaves).not.toContain(FIXTURE_SENDER)
        expect(leaves).not.toContain(FIXTURE_RECEIVER)
        expect(leaves).not.toContain(PAYMENT_FIXTURE_AMOUNT_MICROALGOS)
        expect(leaves).not.toContain(PAYMENT_FIXTURE_FEE_MICROALGOS)
        expect(leaves).not.toContain(PAYMENT_FIXTURE_TRANSACTION_ID)
        expect(leaves).not.toContain(PAYMENT_FIXTURE_UNSIGNED_TRANSACTION)
        expect(leaves).not.toContain(PAYMENT_FIXTURE_SIGNED_TRANSACTION)
      }
    }
  })

  test('the view model derives authoritative facts from structured results at every stage', () => {
    const store = createExplorerFixtureResultStore()
    let state: WriteFlowState | null = null
    for (const kind of HAPPY_PATH) {
      state = advance(state, kind)
      const derived = createPaymentFlowViewModel(store, state)
      expect(derived.ok).toBeTrue()
      if (!derived.ok) continue
      expect(derived.model).toMatchObject({
        flow: 'payment',
        stage: state.stage,
        network: 'localnet',
        sender: FIXTURE_SENDER,
        receiver: FIXTURE_RECEIVER,
        amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
        unsignedGroup: {
          size: 1,
          summary: PAYMENT_FIXTURE_GROUP_SUMMARY,
          transactions: [PAYMENT_FIXTURE_UNSIGNED_TRANSACTION],
        },
      })
      expect(JSON.parse(JSON.stringify(derived.model))).toEqual(derived.model)
    }
    if (!state) throw new Error('Expected confirmed flow')

    const confirmed = createPaymentFlowViewModel(store, state)
    if (!confirmed.ok) throw new Error('Expected confirmed model')
    expect(confirmed.model.simulation).toEqual({
      wouldSucceed: true,
      feeMicroAlgos: PAYMENT_FIXTURE_FEE_MICROALGOS,
      groupSize: 1,
      transactionTypes: ['pay'],
      effects: [
        { account: FIXTURE_SENDER, deltaMicroAlgos: -251000, role: 'sender' },
        {
          account: FIXTURE_RECEIVER,
          deltaMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
          role: 'receiver',
        },
      ],
      simulatedRound: 21,
    })
    expect(confirmed.model.approval).toEqual({
      requestId: PAYMENT_FIXTURE_APPROVAL_REQUEST_ID,
      state: 'approved',
    })
    expect(confirmed.model.signed).toEqual({
      size: 1,
      txIds: [PAYMENT_FIXTURE_TRANSACTION_ID],
      signer: FIXTURE_SENDER,
    })
    expect(confirmed.model.confirmation).toEqual({
      transactionId: PAYMENT_FIXTURE_TRANSACTION_ID,
      confirmedRound: 22,
    })
    expect(confirmed.model.nextEventKinds).toEqual([])
  })

  test('a denied flow presents the decision and offers no further steps', () => {
    const store = createPaymentFixtureResultStore()
    let state: WriteFlowState | null = null
    for (const kind of ['draft', 'simulate', 'inspect', 'request-approval', 'deny'] as const) {
      state = advance(state, kind)
    }
    if (!state) throw new Error('Expected denied flow')
    const derived = createPaymentFlowViewModel(store, state)
    if (!derived.ok) throw new Error('Expected denied model')
    expect(derived.model.stage).toBe('denied')
    expect(derived.model.approval).toEqual({
      requestId: PAYMENT_FIXTURE_APPROVAL_REQUEST_ID,
      state: 'denied',
      reason: 'Denied in Explorer review',
    })
    expect(derived.model.confirmation).toBeUndefined()
    expect(derived.model.nextEventKinds).toEqual([])
  })

  test('refuses to present a simulation that does not match the drafted payment', () => {
    const simulationRecord = paymentFixtureResults.find(
      (record) => record.resultId === PAYMENT_FIXTURE_SIMULATION_RESULT_ID,
    )
    if (!simulationRecord || simulationRecord.state !== 'success') {
      throw new Error('Expected simulation fixture')
    }
    const tamperedData = paymentSimulationDataSchema.parse({
      ...paymentSimulationDataSchema.parse(simulationRecord.data),
      amountMicroAlgos: 999,
    })
    const tamperedStore = createResultStore(
      paymentFixtureResults.map((record): StructuredResult =>
        record.resultId === PAYMENT_FIXTURE_SIMULATION_RESULT_ID && record.state === 'success'
          ? { ...record, data: tamperedData }
          : record,
      ),
    )
    const state = advance(advance(null, 'draft'), 'simulate')
    const derived = createPaymentFlowViewModel(tamperedStore, state)
    expect(derived).toEqual({
      ok: false,
      error: { code: 'INVALID_VIEW_DATA', message: expect.stringContaining('does not simulate') },
    })
  })

  test('the confirmation carries a canonical transaction id distinct from the lookup fixture', () => {
    expect(algorandTransactionIdSchema.safeParse(PAYMENT_FIXTURE_TRANSACTION_ID).success).toBeTrue()
    expect(PAYMENT_FIXTURE_TRANSACTION_ID).not.toBe(FIXTURE_TRANSACTION_ID)
  })

  test('parses the deterministic composer command with an optional exact amount', () => {
    expect(parsePaymentComposerCommand('pay')).toEqual({
      amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
    })
    expect(parsePaymentComposerCommand('  PAY  ')).toEqual({
      amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
    })
    expect(parsePaymentComposerCommand('draft payment')).toEqual({
      amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
    })
    expect(parsePaymentComposerCommand('pay 1.5')).toEqual({ amountMicroAlgos: 1500000 })
    expect(parsePaymentComposerCommand('pay 0')).toBeUndefined()
    expect(parsePaymentComposerCommand('pay 5 to someone')).toBeUndefined()
    expect(parsePaymentComposerCommand(FIXTURE_TRANSACTION_ID)).toBeUndefined()
  })
})
