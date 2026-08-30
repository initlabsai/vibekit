import { describe, expect, test } from 'bun:test'

import { submitAction, performActionStep, startAction, createWalletSignDraft, unsignedTransactionsForDraft, type ActionHost } from '@initlabs/vibekit/actions'
import { createSampleHost, PAYMENT_FIXTURE_SIGNED_TRANSACTION, PAYMENT_FIXTURE_TRANSACTION_ID as SIGNED_FIXTURE_TXID, createFixtureResultStore, FIXTURE_RECEIVER, FIXTURE_SENDER, FIXTURE_TRANSACTION_ID, PAYMENT_FIXTURE_AMOUNT_MICROALGOS } from '@initlabs/vibekit/views/sample'
import { createActionViewModel } from '@initlabs/vibekit/views'

import { resolvePaymentParties, routeComposerInput } from './commands.js'
import { createRemoteExplorerHost } from './remote-host.js'
import { recordSigned } from './wallet/sign-draft.js'

let counter = 0
const newId = (prefix: string) => `${prefix}-${++counter}`
const DRAFT_PARAMS = {
  sender: FIXTURE_SENDER,
  receiver: FIXTURE_RECEIVER,
  amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  note: 'Explorer live payment',
}

/** A host that records draft calls; the sample host answers them. */
function draftingHost(): ActionHost & { drafts: number } {
  const fixture = createSampleHost()
  const host = {
    drafts: 0,
    network: 'localnet',
    draft: (toolName: string, args: Record<string, unknown>) => {
      host.drafts += 1
      return fixture.draft(toolName, args)
    },
    simulateDraft: (record: Parameters<ActionHost['simulateDraft']>[0]) => fixture.simulateDraft(record),
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
  const run = await startAction({
    host,
    store: createFixtureResultStore(),
    draft: { toolName: 'send_payment', args: { ...parties, amountMicroAlgos: route.amountMicroAlgos } },
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
    const prepared = await startAction({
      host,
      store: createFixtureResultStore(),
      draft: { toolName: 'send_payment', args: DRAFT_PARAMS },
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

  test('a host without signDraft rests at approved with nothing signed', async () => {
    const fixture = createSampleHost()
    const host: ActionHost = {
      network: 'localnet',
      draft: (toolName, args) => fixture.draft(toolName, args),
      simulateDraft: (record) => fixture.simulateDraft(record),
    }
    const prepared = await startAction({
      host,
      store: createFixtureResultStore(),
      draft: { toolName: 'send_payment', args: DRAFT_PARAMS },
      newId,
    })
    if (!prepared.ok || !prepared.flow) throw new Error(prepared.message)
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
    })
    expect(done).toMatchObject({ ok: true, pausedForSigner: true })
    expect(done.flow?.stage).toBe('approved')
    expect(done.flow?.signed).toBeUndefined()
  })

  test('a connected wallet signs on approval, the server verifies, and the client polls to confirmed', async () => {
    const fixture = createSampleHost()
    const draft = await fixture.draft('send_payment', DRAFT_PARAMS)
    if (draft.state !== 'success') throw new Error('fixture draft failed')
    const signedBytes = new Uint8Array(Buffer.from(PAYMENT_FIXTURE_SIGNED_TRANSACTION, 'base64'))
    // The wallet's signer: the fixture's real signature over the fixture's real bytes.
    const transactionSigner = async (txns: unknown[]) => txns.map(() => signedBytes)
    const actions: string[] = []
    let polls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      actions.push(String(body.action))
      expect(body.network).toBe('localnet')
      switch (body.action) {
        case 'draft':
          return Response.json({ record: draft })
        case 'simulate':
          return Response.json({ record: await fixture.simulateDraft(draft) })
        case 'record-signed': {
          // What the server does: refuse unless the bytes wrap the drafted group.
          const sent = body.signedTransactions as string[]
          const unsigned = unsignedTransactionsForDraft(body.draftRecord as typeof draft)
          if (sent.length !== unsigned.length || sent[0] !== PAYMENT_FIXTURE_SIGNED_TRANSACTION) {
            return Response.json({ error: 'Signed transaction 0 does not wrap the drafted bytes' }, { status: 400 })
          }
          return Response.json({ record: await fixture.signDraft!(draft) })
        }
        case 'submit':
          expect(body.draftRecord).toBeDefined()
          return Response.json({ txid: SIGNED_FIXTURE_TXID, pending: true })
        case 'confirmation':
          polls += 1
          return polls < 2
            ? Response.json({ pending: true })
            : Response.json({ record: await fixture.submitSigned!(await fixture.signDraft!(draft)) })
        default:
          return Response.json({ error: `unexpected ${body.action}` }, { status: 400 })
      }
    }) as unknown as typeof fetch
    try {
      const host = createRemoteExplorerHost({
        network: 'localnet',
        signDraft: createWalletSignDraft({ network: 'localnet', walletNetwork: () => 'localnet', signer: transactionSigner, record: (d, signed) => recordSigned('localnet', d, signed) }),
      })
      const prepared = await startAction({ host, store: createFixtureResultStore(), draft: { toolName: 'send_payment', args: DRAFT_PARAMS }, newId })
      if (!prepared.ok || !prepared.flow) throw new Error(prepared.message)
      const approved = await performActionStep({ host, store: prepared.store, flow: prepared.flow, kind: 'approve', newId })
      if (!approved.ok) throw new Error(approved.message)
      const done = await submitAction({ host, store: approved.store, flow: approved.flow, newId })
      expect(done.ok).toBe(true)
      expect(done.flow?.stage).toBe('confirmed')
      expect(actions).toEqual(['draft', 'simulate', 'record-signed', 'submit', 'confirmation', 'confirmation'])

      // A wallet on another network never signs.
      const mismatched = createWalletSignDraft({ network: 'localnet', walletNetwork: () => 'mainnet', signer: transactionSigner, record: (d, signed) => recordSigned('localnet', d, signed) })
      await expect(mismatched(draft)).rejects.toThrow('Wallet is on mainnet; the draft is on localnet')

      // A signature over other bytes is refused by the server, and the flow reports it.
      const tampered = createRemoteExplorerHost({
        network: 'localnet',
        signDraft: createWalletSignDraft({
          network: 'localnet',
          walletNetwork: () => 'localnet',
          signer: async (txns: unknown[]) => txns.map(() => new Uint8Array([1, 2, 3])),
          record: (d, signed) => recordSigned('localnet', d, signed),
        }),
      })
      const refused = await submitAction({ host: tampered, store: approved.store, flow: approved.flow, newId })
      expect(refused.ok).toBe(false)
      expect(refused.message).toContain('does not wrap the drafted bytes')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
