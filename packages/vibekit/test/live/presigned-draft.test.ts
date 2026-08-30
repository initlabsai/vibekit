import { describe, expect, test } from 'bun:test'
import algosdk from 'algosdk'
import { bytesToBase64 } from '../../src/core/index.js'

import { createActionViewModel, addResult, createResultStore } from '../../src/views/index.js'
import {
  draftRecordFromComposeWire,
  signDraftWith,
  signedGroupRecordFor,
} from '../../src/live/index.js'

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
const identity = { resultId: 'result-draft', toolCallId: 'tool-call-draft', network: 'mainnet' }
const signedIdentity = {
  resultId: 'result-signed',
  toolCallId: 'tool-call-signed',
  network: 'mainnet',
}

/** A two-leg group where the router's leg comes first and pre-signed; the wallet owns the second. */
function draft() {
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
  const presignedRouter = bytesToBase64(routerLeg.signTxn(router.sk))
  const wire = {
    unsignedGroup: [routerLeg, userLeg].map((txn) =>
      bytesToBase64(algosdk.encodeUnsignedTransaction(txn)),
    ),
    summary: 'swap 10 ALGO → 2.31 USDC via Pact',
    presigned: [presignedRouter, null],
    intent: {
      kind: 'swap',
      fromAssetId: 0,
      toAssetId: 31566704,
      fromUnit: 'ALGO',
      toUnit: 'USDC',
      fromDecimals: 6,
      toDecimals: 6,
      amountIn: '10000000',
      amountOut: '2310000',
      minAmountOut: '2286900',
      slippagePercent: 1,
      route: [{ venue: 'Pact', percentage: 100 }],
    },
  }
  return {
    wire,
    routerLeg,
    userLeg,
    presignedRouter,
    record: draftRecordFromComposeWire(identity, wire, 'swap'),
  }
}

describe('drafts with pre-signed legs', () => {
  test("the sender is the wallet's leg, not the first transaction", () => {
    const { record } = draft()
    expect(record.state).toBe('success')
    if (record.state !== 'success') throw new Error('draft failed')
    expect((record.data as { sender: string }).sender).toBe(user.addr.toString())
  })

  test("the view model exposes the intent and which legs are not the wallet's", () => {
    const { record } = draft()
    const model = createActionViewModel(addResult(createResultStore(), record), {
      flowId: 'flow-1',
      stage: 'drafted',
      draft: { source: 'result', id: record.resultId },
    } as never)
    if (!model.ok) throw new Error(model.error.message)
    expect(model.model.presignedIndexes).toEqual([0])
    expect(model.model.intent).toMatchObject({ kind: 'swap', minAmountOut: '2286900' })
  })

  test("the simulation record names the wallet's sender, so the view model derives", async () => {
    const { buildSimulationRecord } = await import('@initlabs/vibekit/actions')
    const { decodeUnsignedGroup } = await import('../../src/live/index.js')
    const { record, wire } = draft()
    const decoded = decodeUnsignedGroup(wire.unsignedGroup, wire.presigned)
    const simulation = buildSimulationRecord(
      { resultId: 'result-sim', toolCallId: 'tool-call-sim', network: 'mainnet' },
      { wouldSucceed: true, simulatedRound: 1, txids: [] },
      decoded,
    )
    const store = addResult(addResult(createResultStore(), record), simulation)
    const model = createActionViewModel(store, {
      flowId: 'flow-2',
      stage: 'simulated',
      draft: { source: 'result', id: record.resultId },
      simulation: { source: 'result', id: simulation.resultId },
    } as never)
    if (!model.ok) throw new Error(model.error.message)
    expect(model.model.sender).toBe(user.addr.toString())
  })

  test('signDraftWith offers the wallet only its own legs and splices the rest back in order', async () => {
    const { record, presignedRouter } = draft()
    const offered: number[][] = []
    const signer = async (txns: algosdk.Transaction[], indexes: number[]) => {
      offered.push(indexes)
      return indexes.map((index) => txns[index]!.signTxn(user.sk))
    }
    const signed = await signDraftWith(signedIdentity, record, signer)
    expect(offered).toEqual([[1]])
    if (signed.state !== 'success') throw new Error('signing failed')
    const data = signed.data as { transactions: string[]; signer: string }
    expect(data.transactions[0]).toBe(presignedRouter)
    expect(data.signer).toBe(user.addr.toString())
  })

  test('a pre-signed leg the draft did not carry is refused', async () => {
    const { record, routerLeg, userLeg } = draft()
    const imposter = algosdk.generateAccount()
    const group = [routerLeg.signTxn(imposter.sk), userLeg.signTxn(user.sk)]
    expect(() => signedGroupRecordFor(signedIdentity, record, group)).toThrow(
      'not the pre-signed leg',
    )
  })

  test('a wallet leg that does not wrap the drafted bytes is still refused', async () => {
    const { record, routerLeg, userLeg } = draft()
    const other = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: user.addr,
      receiver: router.addr,
      amount: 1,
      suggestedParams: params,
    })
    void userLeg
    const group = [routerLeg.signTxn(router.sk), other.signTxn(user.sk)]
    expect(() => signedGroupRecordFor(signedIdentity, record, group)).toThrow(
      'does not wrap the drafted bytes',
    )
  })
})
