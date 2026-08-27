import { describe, expect, test } from 'bun:test'

import {
  completeApprovedWriteFlow,
  createSampleHost,
  createFixtureResultStore,
  createWriteFlowViewModel,
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  performWriteFlowStep,
  startWriteFlow,
  type WriteFlowHost,
} from '@initlabs/vibekit-explorer'

import { routeComposerInput } from './commands.js'

let counter = 0
const newId = (prefix: string) => `${prefix}-${++counter}`
const DRAFT_PARAMS = {
  sender: FIXTURE_SENDER,
  receiver: FIXTURE_RECEIVER,
  amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  note: 'Explorer live payment',
}

describe('web payment wiring', () => {
  test('routes the composer `pay` command with a default or exact amount', () => {
    expect(routeComposerInput('  Pay ')).toEqual({
      status: 'payment',
      amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
    })
    expect(routeComposerInput('pay 0.000001')).toEqual({ status: 'payment', amountMicroAlgos: 1 })
  })

  test('the transaction lane still resolves alongside the payment lane', () => {
    expect(routeComposerInput(FIXTURE_TRANSACTION_ID).status).toBe('resolved')
    expect(routeComposerInput('nonsense').status).toBe('unresolved')
  })

  test('the browser flow auto-advances to approval and completes after the decision', async () => {
    const host = createSampleHost()
    const stages: string[] = []
    const prepared = await startWriteFlow({
      host,
      store: createFixtureResultStore(),
      draftParams: DRAFT_PARAMS,
      newId,
      onStep: (_store, flow) => stages.push(flow.stage),
    })
    if (!prepared.ok || !prepared.flow) throw new Error(prepared.message)
    expect(prepared.flow.stage).toBe('awaiting-approval')

    const approved = await performWriteFlowStep({
      host,
      store: prepared.store,
      flow: prepared.flow,
      kind: 'approve',
      newId,
    })
    if (!approved.ok) throw new Error(approved.message)
    const done = await completeApprovedWriteFlow({
      host,
      store: approved.store,
      flow: approved.flow,
      newId,
      onStep: (_store, flow) => stages.push(flow.stage),
    })
    if (!done.ok || !done.flow) throw new Error(done.message)
    expect(stages).toEqual([
      'drafted',
      'simulated',
      'inspected',
      'awaiting-approval',
      'signed',
      'confirmed',
    ])

    const derived = createWriteFlowViewModel(done.store, done.flow)
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.confirmation?.transactionId).toBe(derived.model.signed?.txIds[0])
  })

  test('a custody-less remote host rests at approved with nothing signed', async () => {
    const fixture = createSampleHost()
    // The browser's live host has no signDraft — model that shape here.
    const host: WriteFlowHost = {
      network: 'localnet',
      draftPayment: (params) => fixture.draftPayment(params),
      simulateDraft: (record) => fixture.simulateDraft(record),
    }
    const prepared = await startWriteFlow({
      host,
      store: createFixtureResultStore(),
      draftParams: DRAFT_PARAMS,
      newId,
    })
    if (!prepared.ok || !prepared.flow) throw new Error(prepared.message)
    const approved = await performWriteFlowStep({
      host,
      store: prepared.store,
      flow: prepared.flow,
      kind: 'approve',
      newId,
    })
    if (!approved.ok) throw new Error(approved.message)
    const done = await completeApprovedWriteFlow({
      host,
      store: approved.store,
      flow: approved.flow,
      newId,
    })
    expect(done).toMatchObject({ ok: true, pausedForSigner: true })
    expect(done.flow?.stage).toBe('approved')
    expect(done.flow?.signed).toBeUndefined()
  })
})
