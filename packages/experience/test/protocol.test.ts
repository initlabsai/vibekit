import { describe, expect, test } from 'bun:test'

import {
  EXPERIENCE_PROTOCOL_VERSION,
  FIXTURE_RESULT_ID,
  FIXTURE_TOOL_CALL_ID,
  approvalDecisionSchema,
  approvalRequestSchema,
  createTransactionFixtureOpenCommand,
  createTransactionFixtureViewSpec,
  experienceMessageSchema,
  transactionFixtureResult,
  transactionDetailViewSpecSchema,
  workspaceCommandSchema,
  writeStageEventSchema,
} from '../src/index.js'

describe('provisional experience protocol', () => {
  test('visibly versions result, view, workspace, and approval messages', () => {
    const view = createTransactionFixtureViewSpec()
    const command = createTransactionFixtureOpenCommand()
    const request = approvalRequestSchema.parse({
      protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
      type: 'approval.request',
      requestId: 'approval-001',
      state: 'pending',
      toolCallId: FIXTURE_TOOL_CALL_ID,
      inspection: { source: 'result', id: FIXTURE_RESULT_ID },
    })
    const decision = approvalDecisionSchema.parse({
      protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
      type: 'approval.decision',
      requestId: 'approval-001',
      state: 'approved',
    })

    for (const message of [transactionFixtureResult, view, command, request, decision]) {
      expect(experienceMessageSchema.parse(message).protocolVersion).toBe('0.1.0-provisional')
    }
  })

  test('rejects an unknown view, inline authoritative fields, and wrong protocol version', () => {
    const view = createTransactionFixtureViewSpec()
    expect(
      transactionDetailViewSpecSchema.safeParse({
        ...view,
        view: 'model.generated',
      }).success,
    ).toBeFalse()
    expect(
      transactionDetailViewSpecSchema.safeParse({
        ...view,
        transactionId: 'copied-by-model',
      }).success,
    ).toBeFalse()
    expect(
      transactionDetailViewSpecSchema.safeParse({
        ...view,
        protocolVersion: '1.0.0',
      }).success,
    ).toBeFalse()
  })

  test('validates open, replace, patch, focus, and pin commands', () => {
    const open = createTransactionFixtureOpenCommand()
    const commands = [
      open,
      {
        protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
        type: 'workspace.command',
        command: 'replace',
        artifactId: open.artifactId,
        view: open.view,
      },
      {
        protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
        type: 'workspace.command',
        command: 'patch',
        artifactId: open.artifactId,
        patch: { title: 'Inspected transaction' },
      },
      {
        protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
        type: 'workspace.command',
        command: 'focus',
        target: { area: 'workspace', artifactId: open.artifactId },
      },
      {
        protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
        type: 'workspace.command',
        command: 'pin',
        artifactId: open.artifactId,
        pinned: true,
      },
    ]

    for (const command of commands)
      expect(workspaceCommandSchema.safeParse(command).success).toBeTrue()
    expect(
      workspaceCommandSchema.safeParse({
        protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
        type: 'workspace.command',
        command: 'patch',
        artifactId: open.artifactId,
        patch: {},
      }).success,
    ).toBeFalse()
  })

  test('validates write.stage events and rejects inline authoritative fields', () => {
    const draft = {
      protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
      type: 'write.stage',
      stage: 'draft',
      flowId: 'flow-001',
      toolCallId: FIXTURE_TOOL_CALL_ID,
      draft: { source: 'result', id: FIXTURE_RESULT_ID },
    }
    expect(writeStageEventSchema.parse(draft).protocolVersion).toBe('0.1.0-provisional')
    expect(experienceMessageSchema.safeParse(draft).success).toBeTrue()

    expect(writeStageEventSchema.safeParse({ ...draft, stage: 'sign' }).success).toBeFalse()
    expect(writeStageEventSchema.safeParse({ ...draft, amount: 0.25 }).success).toBeFalse()
    expect(
      writeStageEventSchema.safeParse({ ...draft, protocolVersion: '1.0.0' }).success,
    ).toBeFalse()
    expect(
      writeStageEventSchema.safeParse({
        protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
        type: 'write.stage',
        stage: 'confirm',
        flowId: 'flow-001',
        confirmation: { source: 'result', id: FIXTURE_RESULT_ID },
      }).success,
    ).toBeTrue()
  })

  test('keeps approval facts behind an inspection result reference', () => {
    const base = {
      protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
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
