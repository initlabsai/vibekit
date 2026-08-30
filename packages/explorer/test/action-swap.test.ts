/**
 * A swap — a two-leg group with a router's pre-signed leg — through the same
 * action machine as a payment: draft from elsewhere, simulate, approve, sign
 * only the wallet's leg, submit. Also: the live host drafts actions only.
 */
import { describe, expect, test } from 'bun:test'
import algosdk from 'algosdk'
import { bytesToBase64 } from '@initlabs/vibekit'

import {
  createActionViewModel,
  createResultStore,
  performActionStep,
  startAction,
  startActionFromDraft,
  submitAction,
  type ActionHost,
} from '../src/index.js'
import { buildConfirmationRecord, buildSimulationRecord } from '../src/actions/host.js'
import {
  createLiveHost,
  decodeUnsignedGroup,
  draftRecordFromComposeWire,
  signDraftWith,
} from '../src/live/index.js'

let counter = 0
const newId = (prefix: string) => `${prefix}-${++counter}`
const params: algosdk.SuggestedParams = {
  fee: 1000,
  firstValid: 1,
  lastValid: 1001,
  genesisID: 'test',
  genesisHash: new Uint8Array(32),
  minFee: 1000,
}
const user = algosdk.generateAccount()
const router = algosdk.generateAccount()

function swapWire() {
  const routerLeg = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: router.addr,
    receiver: user.addr,
    amount: 2_310_000,
    suggestedParams: params,
  })
  const userLeg = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: user.addr,
    receiver: router.addr,
    amount: 10_000_000,
    suggestedParams: params,
  })
  algosdk.assignGroupID([routerLeg, userLeg])
  return {
    unsignedGroup: [routerLeg, userLeg].map((txn) => bytesToBase64(algosdk.encodeUnsignedTransaction(txn))),
    summary: 'swap 10 ALGO → 2.31 USDC via Pact',
    presigned: [bytesToBase64(routerLeg.signTxn(router.sk)), null],
  }
}

/** A host with a wallet: signs the user's leg, "submits" by recording a confirmation. */
function walletHost(wire: ReturnType<typeof swapWire>, offered: number[][]): ActionHost {
  const decoded = decodeUnsignedGroup(wire.unsignedGroup, wire.presigned)
  const identity = (slug: string) => ({ resultId: newId(`result-${slug}`), toolCallId: newId(`tool-call-${slug}`), network: 'mainnet' })
  return {
    network: 'mainnet',
    draft: async (toolName) => draftRecordFromComposeWire(identity('draft'), wire, toolName),
    simulateDraft: async () =>
      buildSimulationRecord(identity('simulation'), { wouldSucceed: true, simulatedRound: 1, txids: [] }, decoded),
    signDraft: (draftRecord) =>
      signDraftWith(identity('signed'), draftRecord, async (txns, indexes) => {
        offered.push(indexes)
        return indexes.map((index) => txns[index]!.signTxn(user.sk))
      }),
    submitSigned: async (signedRecord) => {
      if (signedRecord.state !== 'success') throw new Error('failed signed record')
      const { txIds } = signedRecord.data as { txIds: string[] }
      return buildConfirmationRecord(identity('confirmation'), { transactionId: txIds[1]!, confirmedRound: 2 })
    },
  }
}

describe('a swap through the action machine', () => {
  test('drafted by the host: draft → approve → wallet signs its leg only → confirmed', async () => {
    const offered: number[][] = []
    const host = walletHost(swapWire(), offered)
    const stages: string[] = []
    const onStep = (_store: unknown, flow: { stage: string }) => stages.push(flow.stage)
    const prepared = await startAction({
      host,
      store: createResultStore(),
      draft: { toolName: 'swap', args: { fromAssetId: 0, toAssetId: 31566704, amount: '10000000' } },
      newId,
      onStep,
    })
    if (!prepared.ok || !prepared.flow) throw new Error(prepared.message)
    const approved = await performActionStep({ host, store: prepared.store, flow: prepared.flow, kind: 'approve', newId })
    if (!approved.ok) throw new Error(approved.message)
    const done = await submitAction({ host, store: approved.store, flow: approved.flow, newId, onStep })
    if (!done.ok || !done.flow) throw new Error(done.message)
    expect(stages).toEqual(['drafted', 'simulated', 'inspected', 'awaiting-approval', 'signed', 'confirmed'])
    expect(offered).toEqual([[1]])
    const model = createActionViewModel(done.store, done.flow)
    if (!model.ok) throw new Error(model.error.message)
    expect(model.model.sender).toBe(user.addr.toString())
    expect(model.model.confirmation?.confirmedRound).toBe(2)
  })

  test('drafted elsewhere (an agent tool call) joins at simulate and denies cleanly', async () => {
    const wire = swapWire()
    const host = walletHost(wire, [])
    const draftRecord = draftRecordFromComposeWire(
      { resultId: 'result-agent', toolCallId: 'tool-call-agent', network: 'mainnet' },
      wire,
      'swap',
    )
    const prepared = await startActionFromDraft({ host, store: createResultStore(), draftRecord, newId })
    if (!prepared.ok || !prepared.flow) throw new Error(prepared.message)
    expect(prepared.flow.stage).toBe('awaiting-approval')
    const denied = await performActionStep({ host, store: prepared.store, flow: prepared.flow, kind: 'deny', newId })
    if (!denied.ok) throw new Error(denied.message)
    expect(denied.flow.stage).toBe('denied')
    expect(denied.flow.signed).toBeUndefined()
  })
})

describe('the live host drafts actions only', () => {
  test('a query is refused before anything touches the network', async () => {
    const host = createLiveHost('localnet')
    await expect(host.draft('lookup_asset', { assetId: 1 })).rejects.toThrow('lookup_asset is a query, not an action')
    await expect(host.draft('no_such_tool', {})).rejects.toThrow('no tool named no_such_tool')
  })
})
