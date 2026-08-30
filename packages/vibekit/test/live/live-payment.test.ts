import { describe, expect, test } from 'bun:test'

import {
  buildDraftRecord,
  buildSimulationRecord,
  type DecodedGroupFacts,
} from '../../src/actions/index.js'
import { structuredResultFromToolEvent } from '../../src/views/bridge.js'
import { createSampleResultStore } from '../../src/views/sample/payment.js'
import { createActionViewModel } from '../../src/views/index.js'
import { createStageEvent, createApprovalDecisionEvent, createApprovalRequestEvent, addResult, type ActionState } from '../../src/actions/index.js'
import { PAYMENT_FIXTURE_UNSIGNED_TRANSACTION } from '../../src/views/sample/index.js'
import {
  draftDataSchema,
  simulationDataSchema,
  signedGroupDataSchema,
  actionReducer,
} from '../../src/actions/index.js'
import { base64ToBytes } from '../../src/core/index.js'

import { decodeUnsignedGroup, signedGroupRecordFor } from '../../src/live/index.js'
import recorded from '../recorded/localnet-payment.json' with { type: 'json' }

const DRAFT_IDENTITY = {
  resultId: 'result-live-draft-001',
  toolCallId: 'tool-call-live-draft-001',
  network: 'localnet',
}
const SIMULATION_IDENTITY = {
  resultId: 'result-live-simulation-001',
  toolCallId: 'tool-call-live-simulation-001',
  network: 'localnet',
}

function decodedFacts(): DecodedGroupFacts {
  return decodeUnsignedGroup(recorded.compose.unsignedGroup)
}

describe('live payment mapping over recorded engine outputs', () => {
  test('decodes the authoritative facts from the real group bytes', () => {
    expect(decodedFacts()).toMatchObject({
      sender: recorded.request.sender,
      receiver: recorded.request.receiver,
      amountMicroAlgos: recorded.request.amountMicroAlgos,
      feeMicroAlgos: 1000,
      note: recorded.request.note,
      transactionTypes: ['pay'],
    })
    expect(decodedFacts().graphTransactions?.[0]).toMatchObject({
      type: 'pay',
      sender: recorded.request.sender,
      receiver: recorded.request.receiver,
    })
  })

  test('the fixture group bytes and the recorded compose output are the same group', () => {
    expect(recorded.compose.unsignedGroup).toEqual([PAYMENT_FIXTURE_UNSIGNED_TRANSACTION])
  })

  test('refuses empty groups and malformed bytes', () => {
    expect(() => decodeUnsignedGroup([])).toThrow('group size')
    expect(() => decodeUnsignedGroup(['aGVsbG8='])).toThrow()
  })

  test('decodeUnsignedGroup accepts a multi-transaction group', () => {
    const txn = recorded.compose.unsignedGroup[0]!
    const facts = decodeUnsignedGroup([txn, txn])
    expect(facts.transactionTypes).toEqual(['pay', 'pay'])
    expect(facts.receiver).toBeUndefined()
    expect(facts.graphTransactions).toHaveLength(2)
    expect(facts.sender).toBe(recorded.request.sender)
  })

  test('wraps the recorded compose output as a valid draft record', () => {
    const record = buildDraftRecord(DRAFT_IDENTITY, recorded.compose, decodedFacts())
    expect(record).toMatchObject({
      state: 'success',
      toolName: 'send_payment',
      network: 'localnet',
    })
    if (record.state !== 'success') throw new Error('Expected success record')
    const data = draftDataSchema.parse(record.data)
    expect(data.amountMicroAlgos).toBe(250000)
    expect(data.unsignedGroup.transactions).toEqual(recorded.compose.unsignedGroup)
    expect(data.unsignedGroup.summary).toBe(recorded.compose.summary)
  })

  test('wraps the recorded simulation with facts from the group under approval', () => {
    const record = buildSimulationRecord(SIMULATION_IDENTITY, recorded.simulate, decodedFacts())
    if (record.state !== 'success') throw new Error('Expected success record')
    const data = simulationDataSchema.parse(record.data)
    expect(data).toMatchObject({
      wouldSucceed: true,
      simulatedRound: recorded.simulate.simulatedRound,
      sender: recorded.request.sender,
      receiver: recorded.request.receiver,
      amountMicroAlgos: 250000,
      feeMicroAlgos: 1000,
      group: { size: 1, transactionTypes: ['pay'] },
    })
    expect(data.effects).toEqual([
      { account: recorded.request.sender, deltaMicroAlgos: -251000 },
      { account: recorded.request.receiver, deltaMicroAlgos: 250000 },
    ])
  })

  test('live records drive the same machine and view model as fixtures', () => {
    const draftRecord = buildDraftRecord(DRAFT_IDENTITY, recorded.compose, decodedFacts())
    const simulationRecord = buildSimulationRecord(
      SIMULATION_IDENTITY,
      recorded.simulate,
      decodedFacts(),
    )
    let store = createSampleResultStore()
    store = addResult(store, draftRecord)
    store = addResult(store, simulationRecord)

    const flowId = 'flow-live-001'
    const steps = [
      createStageEvent({
        stage: 'draft',
        flowId,
        toolCallId: DRAFT_IDENTITY.toolCallId,
        draft: { source: 'result', id: draftRecord.resultId },
      }),
      createStageEvent({
        stage: 'simulate',
        flowId,
        simulation: { source: 'result', id: simulationRecord.resultId },
      }),
      createStageEvent({
        stage: 'inspect',
        flowId,
        inspection: { source: 'result', id: simulationRecord.resultId },
      }),
      createApprovalRequestEvent({
        requestId: 'approval-live-001',
        toolCallId: DRAFT_IDENTITY.toolCallId,
        inspection: { source: 'result', id: simulationRecord.resultId },
      }),
      createApprovalDecisionEvent({ requestId: 'approval-live-001', state: 'approved' }),
    ]
    let flow: ActionState | null = null
    for (const event of steps) {
      const transition = actionReducer(flow, event)
      if (!transition.ok) throw new Error(transition.error.message)
      flow = transition.state
    }
    expect(flow?.stage).toBe('approved')

    const derived = createActionViewModel(store, flow!)
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model).toMatchObject({
      network: 'localnet',
      amountMicroAlgos: 250000,
      unsignedGroup: { size: 1, transactions: recorded.compose.unsignedGroup },
      simulation: { wouldSucceed: true, feeMicroAlgos: 1000 },
      approval: { state: 'approved' },
    })
  })

  test('wraps daemon-signed bytes only when they embed exactly the drafted group', () => {
    const draftRecord = buildDraftRecord(DRAFT_IDENTITY, recorded.compose, decodedFacts())
    const signedBytes = recorded.signed.transactions.map((txn) => base64ToBytes(txn))
    const record = signedGroupRecordFor(
      {
        resultId: 'result-live-signed-001',
        toolCallId: 'tool-call-live-signed-001',
        network: 'localnet',
      },
      draftRecord,
      signedBytes,
    )
    if (record.state !== 'success') throw new Error('Expected success record')
    expect(signedGroupDataSchema.parse(record.data)).toEqual({
      transactions: recorded.signed.transactions,
      txIds: recorded.signed.txIds,
      signer: recorded.request.sender,
    })

    // A signature over anything but the approved bytes must be refused.
    const otherDraft = buildDraftRecord(
      {
        ...DRAFT_IDENTITY,
        resultId: 'result-live-draft-002',
        toolCallId: 'tool-call-live-draft-002',
      },
      {
        ...recorded.compose,
        unsignedGroup: [PAYMENT_FIXTURE_UNSIGNED_TRANSACTION.replace(/YXk=$/, 'YXg=')],
      },
      decodedFacts(),
    )
    expect(() =>
      signedGroupRecordFor(
        {
          resultId: 'result-live-signed-002',
          toolCallId: 'tool-call-live-signed-002',
          network: 'localnet',
        },
        otherDraft,
        signedBytes,
      ),
    ).toThrow()
  })

  test('wraps orchestrator tool-result events as versioned records', () => {
    const success = structuredResultFromToolEvent(
      {
        id: 'tool-call-agent-001',
        toolName: 'send_payment',
        output: recorded.compose,
        isError: false,
      },
      { resultId: 'result-agent-001', network: 'localnet' },
    )
    expect(success).toMatchObject({
      protocolVersion: '0.1.0',
      state: 'success',
      toolCallId: 'tool-call-agent-001',
      data: recorded.compose,
    })

    const failure = structuredResultFromToolEvent(
      {
        id: 'tool-call-agent-002',
        toolName: 'send_payment',
        output: { error: { code: 'NETWORK_REQUIRED', message: 'pass an explicit network' } },
        isError: true,
      },
      { resultId: 'result-agent-002', network: 'localnet' },
    )
    expect(failure).toMatchObject({
      state: 'error',
      error: { code: 'NETWORK_REQUIRED', message: 'pass an explicit network' },
    })
  })
})
