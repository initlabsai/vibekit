import { describe, expect, test } from 'bun:test'

import {
  submitAction,
  createSampleHost,
  createFixtureResultStore,
  createActionViewModel,
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  performActionStep,
  startAction,
} from '@initlabs/vibekit-explorer'

import { paymentLines } from '../src/features/action/cards.js'
import { routeComposerInput } from '../src/commands.js'

let counter = 0
const newId = (prefix: string) => `${prefix}-${++counter}`
const DRAFT_PARAMS = {
  sender: FIXTURE_SENDER,
  receiver: FIXTURE_RECEIVER,
  amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  note: 'Explorer live payment',
}

describe('TUI payment wiring', () => {
  test('routes the composer `pay` command with a default or exact amount', () => {
    expect(routeComposerInput('pay')).toEqual({
      status: 'payment',
      amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
    })
    expect(routeComposerInput('pay 1.5')).toEqual({
      status: 'payment',
      amountMicroAlgos: 1500000,
    })
    expect(routeComposerInput('pay nonsense')).toEqual({ status: 'text', text: 'pay nonsense' })
  })

  test('one command auto-advances to the approval card; one decision completes it', async () => {
    const host = createSampleHost()
    const stages: string[] = []
    const prepared = await startAction({
      host,
      store: createFixtureResultStore(),
      draftParams: DRAFT_PARAMS,
      newId,
      onStep: (_store, flow) => stages.push(flow.stage),
    })
    if (!prepared.ok || !prepared.flow) throw new Error(prepared.message)
    expect(prepared.flow.stage).toBe('awaiting-approval')

    const approved = await performActionStep({
      host,
      store: prepared.store,
      flow: prepared.flow,
      kind: 'approve',
      newId,
    })
    if (!approved.ok) throw new Error(approved.message)
    const done = await submitAction({
      host,
      store: approved.store,
      flow: approved.flow,
      newId,
      onStep: (_store, flow) => stages.push(flow.stage),
    })
    if (!done.ok || !done.flow) throw new Error(done.message)

    // Every observable protocol stage still occurred, in order.
    expect(stages).toEqual([
      'drafted',
      'simulated',
      'inspected',
      'awaiting-approval',
      'signed',
      'confirmed',
    ])

    const derived = createActionViewModel(done.store, done.flow)
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.confirmation?.transactionId).toBe(derived.model.signed?.txIds[0])
  })

  test('denial ends the flow with nothing signed', async () => {
    const host = createSampleHost()
    const prepared = await startAction({
      host,
      store: createFixtureResultStore(),
      draftParams: DRAFT_PARAMS,
      newId,
    })
    if (!prepared.ok || !prepared.flow) throw new Error(prepared.message)
    const denied = await performActionStep({
      host,
      store: prepared.store,
      flow: prepared.flow,
      kind: 'deny',
      newId,
    })
    if (!denied.ok) throw new Error(denied.message)
    expect(denied.flow.stage).toBe('denied')
    expect(denied.flow.signed).toBeUndefined()
  })

  test('payment lines keep the amount, parties, and confirmation facts', async () => {
    const host = createSampleHost()
    const prepared = await startAction({
      host,
      store: createFixtureResultStore(),
      draftParams: DRAFT_PARAMS,
      newId,
    })
    if (!prepared.ok || !prepared.flow) throw new Error(prepared.message)
    const derived = createActionViewModel(prepared.store, prepared.flow)
    if (!derived.ok) throw new Error(derived.error.message)
    const lines = paymentLines(derived.model)
    expect(lines[0]).toContain('ALGO')
    expect(lines[1]).toContain(FIXTURE_SENDER)
    expect(lines[2]).toContain(FIXTURE_RECEIVER)
    expect(lines.join('\n')).toMatch(/would succeed|WOULD FAIL/)
  })
})
