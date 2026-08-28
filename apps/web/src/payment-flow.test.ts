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

import { resolvePaymentParties, routeComposerInput } from './commands.js'

let counter = 0
const newId = (prefix: string) => `${prefix}-${++counter}`
const DRAFT_PARAMS = {
  sender: FIXTURE_SENDER,
  receiver: FIXTURE_RECEIVER,
  amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  note: 'Explorer live payment',
}

/** A host that records draft calls; the sample host answers them. */
function draftingHost(): WriteFlowHost & { drafts: number } {
  const fixture = createSampleHost()
  const host = {
    drafts: 0,
    network: 'localnet',
    draftPayment: (params: typeof DRAFT_PARAMS) => {
      host.drafts += 1
      return fixture.draftPayment(params)
    },
    simulateDraft: (record: Parameters<WriteFlowHost['simulateDraft']>[0]) => fixture.simulateDraft(record),
  }
  return host
}

/** What the web's start-payment path does before drafting: resolve parties, refuse or draft. */
async function startPayment(args: {
  live: boolean
  accounts: Array<{ address: string; name?: string }>
  raw: string
}) {
  const host = draftingHost()
  const route = routeComposerInput(args.raw)
  if (route.status !== 'payment') throw new Error(`Expected payment, got ${route.status}`)
  const parties = resolvePaymentParties({
    live: args.live,
    accounts: args.accounts,
    activeAddress: args.accounts[0]?.address,
    to: route.to,
  })
  if ('error' in parties) return { host, error: parties.error }
  const run = await startWriteFlow({
    host,
    store: createFixtureResultStore(),
    draftParams: { ...parties, amountMicroAlgos: route.amountMicroAlgos },
    newId,
  })
  return { host, run }
}

describe('web payment wiring', () => {
  test('`Pay` still routes as a payment with the default amount', () => {
    expect(routeComposerInput('  Pay ')).toEqual({
      status: 'payment',
      amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
    })
    expect(routeComposerInput('pay 0.000001')).toEqual({ status: 'payment', amountMicroAlgos: 1 })
    expect(routeComposerInput(FIXTURE_TRANSACTION_ID).status).toBe('transaction')
    expect(routeComposerInput('nonsense').status).toBe('text')
  })

  test('sample host: a bare pay drafts the fixture parties', async () => {
    const { host, run } = await startPayment({ live: false, accounts: [], raw: 'pay' })
    expect(host.drafts).toBe(1)
    expect(run?.flow?.stage).toBe('awaiting-approval')
  })

  test('live: pay without a receiver does not draft', async () => {
    const { host, error } = await startPayment({
      live: true,
      accounts: [{ address: FIXTURE_SENDER, name: 'alice' }],
      raw: 'pay 0.5',
    })
    expect(host.drafts).toBe(0)
    expect(error).toContain('Name the receiver')
  })

  test('live: pay to a valid address with no wallet does not draft', async () => {
    const { host, error } = await startPayment({
      live: true,
      accounts: [],
      raw: `pay 0.5 to ${FIXTURE_RECEIVER}`,
    })
    expect(host.drafts).toBe(0)
    expect(error).toBe('connect a wallet to pay')
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

  test('a host without signDraft rests at approved with nothing signed', async () => {
    const fixture = createSampleHost()
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
