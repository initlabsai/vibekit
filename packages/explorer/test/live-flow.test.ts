import { describe, expect, test } from 'bun:test'

import {
  buildConfirmationRecord,
  buildDraftRecord,
  buildSignedGroupRecord,
  buildSimulationRecord,
} from '@initlabs/vibekit/actions'
import {
  submitAction,
  createSampleHost,
  createFixtureResultStore,
  startAction,
  createActionViewModel,
  performActionStep,
  type ActionHost,
  type ResultStore,
  type ActionState,
} from '../src/index.js'
import { createExplorerFixtureResultStore } from '../src/sample/payment.js'
import { decodeUnsignedGroup } from '../src/live/index.js'
import recorded from './recorded/localnet-payment.json' with { type: 'json' }

let counter = 0
const newId = (prefix: string) => `${prefix}-${++counter}`

function stubHost(overrides: Partial<ActionHost> = {}): ActionHost {
  const decoded = decodeUnsignedGroup(recorded.compose.unsignedGroup)
  return {
    network: 'localnet',
    async draft() {
      return buildDraftRecord(
        {
          resultId: newId('result-stub-draft'),
          toolCallId: newId('tool-call-stub-draft'),
          network: 'localnet',
        },
        recorded.compose,
        decoded,
      )
    },
    async simulateDraft(draftRecord) {
      return buildSimulationRecord(
        {
          resultId: newId('result-stub-simulation'),
          toolCallId: newId('tool-call-stub-simulation'),
          network: draftRecord.network,
        },
        recorded.simulate,
        decoded,
      )
    },
    ...overrides,
  }
}

const DRAFT_PARAMS = {
  sender: recorded.request.sender,
  receiver: recorded.request.receiver,
  amountMicroAlgos: recorded.request.amountMicroAlgos,
  note: recorded.request.note,
}

describe('shared live payment flow controller', () => {
  test('walks draft → simulate → inspect → approval → decision over host-produced records', async () => {
    const host = stubHost()
    let store: ResultStore = createExplorerFixtureResultStore()
    let flow: ActionState | null = null

    for (const kind of ['draft', 'simulate', 'inspect', 'request-approval', 'approve'] as const) {
      const outcome = await performActionStep({
        host,
        store,
        flow,
        kind,
        draft: { toolName: 'send_payment', args: DRAFT_PARAMS },
        newId,
      })
      expect(outcome.ok).toBeTrue()
      if (!outcome.ok) return
      store = outcome.store
      flow = outcome.flow
    }
    expect(flow?.stage).toBe('approved')

    const derived = createActionViewModel(store, flow!)
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.simulation?.wouldSucceed).toBeTrue()
    expect(derived.model.unsignedGroup.transactions).toEqual(recorded.compose.unsignedGroup)
  })

  test('refuses signing and confirmation on a host without those capabilities', async () => {
    const host = stubHost()
    let store: ResultStore = createExplorerFixtureResultStore()
    let flow: ActionState | null = null
    for (const kind of ['draft', 'simulate', 'inspect', 'request-approval', 'approve'] as const) {
      const outcome = await performActionStep({
        host,
        store,
        flow,
        kind,
        draft: { toolName: 'send_payment', args: DRAFT_PARAMS },
        newId,
      })
      if (!outcome.ok) throw new Error(outcome.message)
      store = outcome.store
      flow = outcome.flow
    }

    const sign = await performActionStep({ host, store, flow, kind: 'sign', newId })
    expect(sign).toEqual({ ok: false, message: expect.stringContaining('no signer') })
    const confirm = await performActionStep({ host, store, flow, kind: 'confirm', newId })
    expect(confirm).toEqual({ ok: false, message: expect.stringContaining('cannot submit') })
  })

  test('a signing host walks the flow to a confirmed on-chain record', async () => {
    const host = stubHost({
      async signDraft() {
        return buildSignedGroupRecord(
          {
            resultId: newId('result-stub-signed'),
            toolCallId: newId('tool-call-stub-signed'),
            network: 'localnet',
          },
          recorded.signed,
        )
      },
      async submitSigned() {
        return buildConfirmationRecord(
          {
            resultId: newId('result-stub-confirmation'),
            toolCallId: newId('tool-call-stub-confirmation'),
            network: 'localnet',
          },
          recorded.confirmation,
        )
      },
    })
    let store: ResultStore = createExplorerFixtureResultStore()
    let flow: ActionState | null = null
    const kinds = [
      'draft',
      'simulate',
      'inspect',
      'request-approval',
      'approve',
      'sign',
      'confirm',
    ] as const
    for (const kind of kinds) {
      const outcome = await performActionStep({
        host,
        store,
        flow,
        kind,
        draft: { toolName: 'send_payment', args: DRAFT_PARAMS },
        newId,
      })
      if (!outcome.ok) throw new Error(`${kind}: ${outcome.message}`)
      store = outcome.store
      flow = outcome.flow
    }
    expect(flow?.stage).toBe('confirmed')

    const derived = createActionViewModel(store, flow!)
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.signed).toEqual({
      size: 1,
      txIds: recorded.signed.txIds,
      signer: recorded.signed.signer,
    })
    expect(derived.model.confirmation).toEqual(recorded.confirmation)
  })

  test('signing is never invoked before an approved decision exists', async () => {
    let signCalls = 0
    const host = stubHost({
      async signDraft() {
        signCalls += 1
        throw new Error('should not be called')
      },
    })
    let store: ResultStore = createExplorerFixtureResultStore()
    let flow: ActionState | null = null
    for (const kind of ['draft', 'simulate', 'inspect', 'request-approval'] as const) {
      const outcome = await performActionStep({
        host,
        store,
        flow,
        kind,
        draft: { toolName: 'send_payment', args: DRAFT_PARAMS },
        newId,
      })
      if (!outcome.ok) throw new Error(outcome.message)
      store = outcome.store
      flow = outcome.flow
    }

    const sign = await performActionStep({ host, store, flow, kind: 'sign', newId })
    expect(sign).toEqual({ ok: false, message: 'Cannot sign from stage awaiting-approval' })
    expect(signCalls).toBe(0)
  })

  test('surfaces host failures as explicit refusals, never partial state', async () => {
    const host = stubHost({
      async draft() {
        throw new Error('algod unreachable')
      },
    })
    const store = createExplorerFixtureResultStore()
    const outcome = await performActionStep({
      host,
      store,
      flow: null,
      kind: 'draft',
      draft: { toolName: 'send_payment', args: DRAFT_PARAMS },
      newId,
    })
    expect(outcome).toEqual({ ok: false, message: 'algod unreachable' })
  })

  test('refuses out-of-order steps with the machine message', async () => {
    const host = stubHost()
    const store = createExplorerFixtureResultStore()
    const outcome = await performActionStep({
      host,
      store,
      flow: null,
      kind: 'simulate',
      newId,
    })
    expect(outcome).toEqual({ ok: false, message: 'No action is open' })
  })
})

describe('auto-advanced payment flow', () => {
  test('runs the mechanical stages and pauses only at the human decision', async () => {
    const host = createSampleHost()
    const seenStages: string[] = []
    const run = await startAction({
      host,
      store: createFixtureResultStore(),
      draft: { toolName: 'send_payment', args: DRAFT_PARAMS },
      newId,
      onStep: (_store, flow) => seenStages.push(flow.stage),
    })
    expect(run.ok).toBeTrue()
    expect(seenStages).toEqual(['drafted', 'simulated', 'inspected', 'awaiting-approval'])
    expect(run.flow?.stage).toBe('awaiting-approval')

    const derived = createActionViewModel(run.store, run.flow!)
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.approval?.state).toBe('pending')
  })

  test('after approval a signing host completes to a confirmed record', async () => {
    const host = createSampleHost()
    const started = await startAction({
      host,
      store: createFixtureResultStore(),
      draft: { toolName: 'send_payment', args: DRAFT_PARAMS },
      newId,
    })
    if (!started.ok || !started.flow) throw new Error(started.message)
    const approved = await performActionStep({
      host,
      store: started.store,
      flow: started.flow,
      kind: 'approve',
      newId,
    })
    if (!approved.ok) throw new Error(approved.message)

    const seenStages: string[] = []
    const done = await submitAction({
      host,
      store: approved.store,
      flow: approved.flow,
      newId,
      onStep: (_store, flow) => seenStages.push(flow.stage),
    })
    expect(done.ok).toBeTrue()
    expect(seenStages).toEqual(['signed', 'confirmed'])
    expect(done.flow?.stage).toBe('confirmed')

    const derived = createActionViewModel(done.store, done.flow!)
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.confirmation?.transactionId).toBe(derived.model.signed?.txIds[0])
  })

  test('a custody-less host rests honestly at approved', async () => {
    const host = stubHost()
    const started = await startAction({
      host,
      store: createFixtureResultStore(),
      draft: { toolName: 'send_payment', args: DRAFT_PARAMS },
      newId,
    })
    if (!started.ok || !started.flow) throw new Error(started.message)
    const approved = await performActionStep({
      host,
      store: started.store,
      flow: started.flow,
      kind: 'approve',
      newId,
    })
    if (!approved.ok) throw new Error(approved.message)

    const done = await submitAction({
      host,
      store: approved.store,
      flow: approved.flow,
      newId,
    })
    expect(done).toMatchObject({ ok: true, pausedForSigner: true })
    expect(done.flow?.stage).toBe('approved')
  })

  test('a failed step keeps the progress already made', async () => {
    const host = createSampleHost()
    const broken = {
      ...host,
      async simulateDraft(): Promise<never> {
        throw new Error('algod unreachable')
      },
    }
    const run = await startAction({
      host: broken,
      store: createFixtureResultStore(),
      draft: { toolName: 'send_payment', args: DRAFT_PARAMS },
      newId,
    })
    expect(run.ok).toBeFalse()
    expect(run.message).toBe('algod unreachable')
    expect(run.flow?.stage).toBe('drafted')
  })

  test('completing is refused before an approval decision exists', async () => {
    const host = createSampleHost()
    const started = await startAction({
      host,
      store: createFixtureResultStore(),
      draft: { toolName: 'send_payment', args: DRAFT_PARAMS },
      newId,
    })
    if (!started.ok || !started.flow) throw new Error(started.message)
    const done = await submitAction({
      host,
      store: started.store,
      flow: started.flow,
      newId,
    })
    expect(done).toMatchObject({
      ok: false,
      message: 'Cannot sign from stage awaiting-approval',
    })
  })
})
