import { describe, expect, test } from 'bun:test'

import {
  EXPLORER_PROTOCOL_VERSION,
  FIXTURE_RESULT_ID,
  FIXTURE_SENDER,
  FIXTURE_TOOL_CALL_ID,
  addResult,
  createFixtureResultStore,
  createResultStore,
  resolveResultReference,
  structuredResultSchema,
  transactionFixtureResult,
} from '../src/index.js'

describe('client-owned result store', () => {
  test('resolves by result id, tool-call id, and optional data path', () => {
    const store = createFixtureResultStore()
    const root = resolveResultReference(store, {
      source: 'result',
      id: FIXTURE_RESULT_ID,
    })
    const sender = resolveResultReference(store, {
      source: 'tool-call',
      id: FIXTURE_TOOL_CALL_ID,
      path: ['sender'],
    })

    expect(root.ok && typeof root.value === 'object').toBeTrue()
    expect(sender).toMatchObject({ ok: true, value: FIXTURE_SENDER })
  })

  test('returns explicit failures for missing results, paths, and failed records', () => {
    const store = createFixtureResultStore()
    expect(resolveResultReference(store, { source: 'result', id: 'missing' })).toMatchObject({
      ok: false,
      error: { code: 'RESULT_NOT_FOUND' },
    })
    expect(
      resolveResultReference(store, {
        source: 'result',
        id: FIXTURE_RESULT_ID,
        path: ['missing'],
      }),
    ).toMatchObject({ ok: false, error: { code: 'PATH_NOT_FOUND' } })

    const failed = createResultStore([
      {
        protocolVersion: EXPLORER_PROTOCOL_VERSION,
        type: 'result',
        state: 'error',
        resultId: 'failed-result',
        toolCallId: 'failed-tool-call',
        toolName: 'lookup_transaction',
        network: 'localnet',
        error: { code: 'NOT_FOUND', message: 'No transaction found' },
      },
    ])
    expect(resolveResultReference(failed, { source: 'result', id: 'failed-result' })).toMatchObject(
      {
        ok: false,
        error: { code: 'RESULT_FAILED' },
      },
    )
  })

  test('adds records as values without mutating the previous store', () => {
    const initial = createFixtureResultStore()
    const next = addResult(initial, {
      protocolVersion: EXPLORER_PROTOCOL_VERSION,
      type: 'result',
      state: 'error',
      resultId: 'result-002',
      toolCallId: 'tool-call-002',
      toolName: 'lookup_transaction',
      network: 'localnet',
      error: { code: 'NOT_FOUND', message: 'No transaction found' },
    })

    expect(initial).toHaveLength(1)
    expect(next).toHaveLength(2)
    expect(Object.isFrozen(initial)).toBeTrue()
    expect(Object.isFrozen(initial[0])).toBeTrue()
  })

  test('rejects duplicate result and tool-call ids', () => {
    expect(() => createResultStore([transactionFixtureResult, transactionFixtureResult])).toThrow(
      `Duplicate result id: ${FIXTURE_RESULT_ID}`,
    )
    expect(() =>
      createResultStore([
        transactionFixtureResult,
        { ...transactionFixtureResult, resultId: 'another-result' },
      ]),
    ).toThrow(`Duplicate tool-call id: ${FIXTURE_TOOL_CALL_ID}`)
  })

  test('rejects data that is not JSON-safe', () => {
    expect(
      structuredResultSchema.safeParse({
        ...transactionFixtureResult,
        data: { amount: 1n },
      }).success,
    ).toBeFalse()
    expect(() => JSON.stringify(transactionFixtureResult)).not.toThrow()
  })
})
