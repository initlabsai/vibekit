import { describe, expect, test } from 'bun:test'

import { buildTransactionDetailRecord } from '../../src/views/transaction.js'
import {
  createSampleHost,
  createFixtureResultStore,
  createActionViewModel,
  createTransactionDetailViewModel,
  bridgeToolResult,
  unsignedGroupFromToolResult,
  PAYMENT_FIXTURE_TRANSACTION_ID,
  startActionFromDraft,
  type ToolResultEventLike,
} from '../../src/views/index.js'
import { draftRecordFromComposeWire } from '../../src/live/index.js'
import recorded from '../recorded/localnet-payment.json' with { type: 'json' }

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
  test('the declared view id selects the trusted view — not the tool name', () => {
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
      protocolVersion: '0.1.0',
      type: 'view',
      view: 'transaction.detail',
      source: { source: 'result', id: bridged.record.resultId },
    })
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.id).toBe(PAYMENT_FIXTURE_TRANSACTION_ID)
    expect(derived.model.note).toBe('Explorer fixture payment')
  })

  test('acfg/afrz/created/signer fields flow into the detail record and view model', () => {
    const wire = {
      id: 'ACREATE2TXID2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      type: 'acfg',
      sender: recorded.request.sender,
      feeMicroAlgos: 1000,
      confirmedRound: 23,
      assetId: 0,
      createdAssetId: 987,
      assetConfig: {
        total: '18446744073709551615',
        decimals: 6,
        unitName: 'MAX',
        manager: recorded.request.sender,
      },
      signer: recorded.request.receiver,
    }
    const record = buildTransactionDetailRecord(identity(), wire)
    expect(record).toMatchObject({
      state: 'success',
      data: {
        assetId: 0,
        createdAssetId: 987,
        assetConfig: { total: '18446744073709551615', decimals: 6, unitName: 'MAX' },
        signer: recorded.request.receiver,
      },
    })

    const store = [...createFixtureResultStore(), record]
    const derived = createTransactionDetailViewModel(store, {
      protocolVersion: '0.1.0',
      type: 'view',
      view: 'transaction.detail',
      source: { source: 'result', id: record.resultId },
    })
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.createdAssetId).toBe(987)
    expect(derived.model.assetConfig?.total).toBe('18446744073709551615')
    expect(derived.model.signer).toBe(recorded.request.receiver)
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
    // The promise that was broken, and the first reason why.
    expect(bridged.degraded?.view).toBe('transaction.detail')
    expect(bridged.degraded?.reason).toMatch(/^sender: /)
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
    const compose = unsignedGroupFromToolResult(event)
    expect(compose?.unsignedGroup).toEqual(recorded.compose.unsignedGroup)

    const draftRecord = draftRecordFromComposeWire(identity(), compose)
    const run = await startActionFromDraft({
      host: createSampleHost(),
      store: createFixtureResultStore(),
      draftRecord,
      newId,
    })
    if (!run.ok || !run.flow) throw new Error(run.message)
    expect(run.flow.stage).toBe('awaiting-approval')

    const derived = createActionViewModel(run.store, run.flow)
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.amountMicroAlgos).toBe(250000)
    expect(derived.model.unsignedGroup.transactions).toEqual(recorded.compose.unsignedGroup)
  })

  test('unsigned-group shaped results intercept regardless of tool name', () => {
    expect(
      unsignedGroupFromToolResult({
        id: 'call-6',
        toolName: 'app_call',
        output: recorded.compose,
        isError: false,
      })?.unsignedGroup,
    ).toEqual(recorded.compose.unsignedGroup)
    expect(
      unsignedGroupFromToolResult({
        id: 'call-7',
        toolName: 'lookup_transaction',
        output: {
          id: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
          sender: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
          feeMicroAlgos: 1000,
        },
        isError: false,
      }),
    ).toBeUndefined()
    expect(
      unsignedGroupFromToolResult({
        id: 'call-8',
        toolName: 'send_payment',
        output: { error: { code: 'DENIED', message: 'denied' } },
        isError: true,
      }),
    ).toBeUndefined()
  })
})
