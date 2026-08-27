import { describe, expect, test } from 'bun:test'

import { createPaymentFixtureEvent, PAYMENT_FIXTURE_FLOW_ID } from '../src/sample/payment.js'
import {
  writeFlowNextEventKinds,
  writeFlowReducer,
  writeFlowStateSchema,
  type WriteFlowEventKind,
} from '../src/flows/write-flow.js'
import { type WriteFlowState } from '../src/index.js'

function advance(state: WriteFlowState | null, kind: WriteFlowEventKind): WriteFlowState {
  const transition = writeFlowReducer(state, createPaymentFixtureEvent(kind))
  if (!transition.ok) throw new Error(`Expected ${kind} to advance: ${transition.error.message}`)
  return transition.state
}

function flowAt(
  kind: 'drafted' | 'simulated' | 'inspected' | 'awaiting-approval' | 'approved' | 'signed',
) {
  let state = advance(null, 'draft')
  if (kind === 'drafted') return state
  state = advance(state, 'simulate')
  if (kind === 'simulated') return state
  state = advance(state, 'inspect')
  if (kind === 'inspected') return state
  state = advance(state, 'request-approval')
  if (kind === 'awaiting-approval') return state
  state = advance(state, 'approve')
  if (kind === 'approved') return state
  return advance(state, 'sign')
}

describe('write flow state machine', () => {
  test('walks draft → simulate → inspect → approval → confirm with valid states', () => {
    const kinds = [
      'draft',
      'simulate',
      'inspect',
      'request-approval',
      'approve',
      'sign',
      'confirm',
    ] as const
    const expectedStages = [
      'drafted',
      'simulated',
      'inspected',
      'awaiting-approval',
      'approved',
      'signed',
      'confirmed',
    ]

    let state: WriteFlowState | null = null
    const stages: string[] = []
    for (const kind of kinds) {
      state = advance(state, kind)
      expect(writeFlowStateSchema.safeParse(state).success).toBeTrue()
      stages.push(state.stage)
    }
    expect(stages).toEqual(expectedStages)
    if (!state) throw new Error('Expected final state')
    expect(state.flowId).toBe(PAYMENT_FIXTURE_FLOW_ID)
    expect(state.approvalDecision?.state).toBe('approved')
    expect(state.signed).toBeDefined()
    expect(state.confirmation).toBeDefined()
  })

  test('denial is terminal and keeps its reason', () => {
    const denied = advance(flowAt('awaiting-approval'), 'deny')
    expect(denied.stage).toBe('denied')
    expect(denied.approvalDecision?.reason).toBe('Denied in Explorer review')
    expect(writeFlowStateSchema.safeParse(denied).success).toBeTrue()
    expect(writeFlowNextEventKinds(denied)).toEqual([])

    const confirm = writeFlowReducer(denied, createPaymentFixtureEvent('sign'))
    expect(confirm).toEqual({
      ok: false,
      error: { code: 'INVALID_TRANSITION', message: expect.any(String) },
    })
  })

  test('refuses skipped and repeated stages explicitly', () => {
    const cases: Array<[WriteFlowState | null, WriteFlowEventKind]> = [
      [null, 'simulate'],
      [null, 'approve'],
      [flowAt('drafted'), 'draft'],
      [flowAt('drafted'), 'inspect'],
      [flowAt('drafted'), 'request-approval'],
      [flowAt('simulated'), 'simulate'],
      [flowAt('simulated'), 'approve'],
      [flowAt('inspected'), 'approve'],
      [flowAt('inspected'), 'confirm'],
      [flowAt('awaiting-approval'), 'request-approval'],
      [flowAt('awaiting-approval'), 'sign'],
      [flowAt('approved'), 'approve'],
      [flowAt('approved'), 'confirm'],
      [flowAt('signed'), 'sign'],
      [advance(flowAt('signed'), 'confirm'), 'confirm'],
    ]
    for (const [state, kind] of cases) {
      const transition = writeFlowReducer(state, createPaymentFixtureEvent(kind))
      expect(transition.ok).toBeFalse()
      if (transition.ok) continue
      expect(transition.error.code).toBe('INVALID_TRANSITION')
    }
  })

  test('refuses events addressed to another flow, tool call, or request', () => {
    const drafted = flowAt('drafted')
    const otherFlow = writeFlowReducer(drafted, {
      ...createPaymentFixtureEvent('simulate'),
      flowId: 'flow-other',
    } as never)
    expect(otherFlow).toMatchObject({
      ok: false,
      error: { code: 'FLOW_MISMATCH' },
    })

    const inspected = flowAt('inspected')
    const request = createPaymentFixtureEvent('request-approval')
    if (request.type !== 'approval.request') throw new Error('Expected approval request')

    const wrongToolCall = writeFlowReducer(inspected, {
      ...request,
      toolCallId: 'tool-call-other',
    })
    expect(wrongToolCall).toMatchObject({
      ok: false,
      error: { code: 'APPROVAL_MISMATCH' },
    })

    const wrongInspection = writeFlowReducer(inspected, {
      ...request,
      inspection: { source: 'result', id: 'result-other' },
    })
    expect(wrongInspection).toMatchObject({
      ok: false,
      error: { code: 'APPROVAL_MISMATCH' },
    })

    const decision = createPaymentFixtureEvent('approve')
    if (decision.type !== 'approval.decision') throw new Error('Expected approval decision')
    const wrongRequest = writeFlowReducer(flowAt('awaiting-approval'), {
      ...decision,
      requestId: 'approval-other',
    })
    expect(wrongRequest).toMatchObject({
      ok: false,
      error: { code: 'APPROVAL_MISMATCH' },
    })
  })

  test('offers exactly the legal next event kinds at every stage', () => {
    expect(writeFlowNextEventKinds(null)).toEqual(['draft'])
    expect(writeFlowNextEventKinds(flowAt('drafted'))).toEqual(['simulate'])
    expect(writeFlowNextEventKinds(flowAt('simulated'))).toEqual(['inspect'])
    expect(writeFlowNextEventKinds(flowAt('inspected'))).toEqual(['request-approval'])
    expect(writeFlowNextEventKinds(flowAt('awaiting-approval'))).toEqual(['approve', 'deny'])
    expect(writeFlowNextEventKinds(flowAt('approved'))).toEqual(['sign'])
    expect(writeFlowNextEventKinds(flowAt('signed'))).toEqual(['confirm'])
    expect(writeFlowNextEventKinds(advance(flowAt('signed'), 'confirm'))).toEqual([])
  })

  test('the state schema rejects stage and field combinations the machine cannot produce', () => {
    const confirmed = advance(flowAt('signed'), 'confirm')

    expect(
      writeFlowStateSchema.safeParse({ ...confirmed, simulation: undefined }).success,
    ).toBeFalse()
    expect(writeFlowStateSchema.safeParse({ ...confirmed, stage: 'drafted' }).success).toBeFalse()
    expect(
      writeFlowStateSchema.safeParse({
        ...flowAt('drafted'),
        confirmation: confirmed.confirmation,
      }).success,
    ).toBeFalse()
    expect(
      writeFlowStateSchema.safeParse({ ...flowAt('approved'), signed: confirmed.signed }).success,
    ).toBeFalse()
    expect(writeFlowStateSchema.safeParse({ ...confirmed, signed: undefined }).success).toBeFalse()
    expect(
      writeFlowStateSchema.safeParse({
        ...confirmed,
        approvalRequest: {
          ...confirmed.approvalRequest,
          toolCallId: 'tool-call-other',
        },
      }).success,
    ).toBeFalse()
    expect(
      writeFlowStateSchema.safeParse({
        ...confirmed,
        approvalDecision: { ...confirmed.approvalDecision, state: 'denied' },
      }).success,
    ).toBeFalse()
  })
})
