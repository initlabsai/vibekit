import { describe, expect, test } from 'bun:test'

import {
  EXPLORER_PROTOCOL_VERSION,
  FIXTURE_RESULT_ID,
  approvalDecisionSchema,
  approvalRequestSchema,
  viewSpecSchema,
  writeStageEventSchema,
} from '../src/index.js'
import {
  FIXTURE_TOOL_CALL_ID,
  createTransactionFixtureViewSpec,
  transactionFixtureResult,
} from '../src/sample/transaction.js'

describe('explorer protocol', () => {
  test('visibly versions result, view, and approval messages', () => {
    const view = createTransactionFixtureViewSpec()
    const request = approvalRequestSchema.parse({
      protocolVersion: EXPLORER_PROTOCOL_VERSION,
      type: 'approval.request',
      requestId: 'approval-001',
      state: 'pending',
      toolCallId: FIXTURE_TOOL_CALL_ID,
      inspection: { source: 'result', id: FIXTURE_RESULT_ID },
    })
    const decision = approvalDecisionSchema.parse({
      protocolVersion: EXPLORER_PROTOCOL_VERSION,
      type: 'approval.decision',
      requestId: 'approval-001',
      state: 'approved',
    })

    for (const message of [transactionFixtureResult, view, request, decision]) {
      expect(message.protocolVersion).toBe('0.1.0')
    }
  })

  test('rejects an unknown view, inline authoritative fields, and wrong protocol version', () => {
    const view = createTransactionFixtureViewSpec()
    expect(
      viewSpecSchema.safeParse({
        ...view,
        view: 'model.generated',
      }).success,
    ).toBeFalse()
    expect(
      viewSpecSchema.safeParse({
        ...view,
        transactionId: 'copied-by-model',
      }).success,
    ).toBeFalse()
    expect(
      viewSpecSchema.safeParse({
        ...view,
        protocolVersion: '1.0.0',
      }).success,
    ).toBeFalse()
  })

  test('validates write.stage events and rejects inline authoritative fields', () => {
    const draft = {
      protocolVersion: EXPLORER_PROTOCOL_VERSION,
      type: 'write.stage',
      stage: 'draft',
      flowId: 'flow-001',
      toolCallId: FIXTURE_TOOL_CALL_ID,
      draft: { source: 'result', id: FIXTURE_RESULT_ID },
    }
    expect(writeStageEventSchema.parse(draft).protocolVersion).toBe('0.1.0')
    expect(writeStageEventSchema.safeParse({ ...draft, stage: 'sign' }).success).toBeFalse()
    expect(writeStageEventSchema.safeParse({ ...draft, amount: 0.25 }).success).toBeFalse()
    expect(
      writeStageEventSchema.safeParse({ ...draft, protocolVersion: '1.0.0' }).success,
    ).toBeFalse()
    expect(
      writeStageEventSchema.safeParse({
        protocolVersion: EXPLORER_PROTOCOL_VERSION,
        type: 'write.stage',
        stage: 'confirm',
        flowId: 'flow-001',
        confirmation: { source: 'result', id: FIXTURE_RESULT_ID },
      }).success,
    ).toBeTrue()
  })

  test('keeps approval facts behind an inspection result reference', () => {
    const base = {
      protocolVersion: EXPLORER_PROTOCOL_VERSION,
      type: 'approval.request',
      requestId: 'approval-001',
      state: 'pending',
      toolCallId: FIXTURE_TOOL_CALL_ID,
      inspection: { source: 'tool-call', id: FIXTURE_TOOL_CALL_ID },
    } as const

    expect(approvalRequestSchema.safeParse(base).success).toBeTrue()
    expect(
      approvalRequestSchema.safeParse({ ...base, amount: 10, sender: 'copied' }).success,
    ).toBeFalse()
  })
})
