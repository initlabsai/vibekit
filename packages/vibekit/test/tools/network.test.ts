import { describe, expect, test } from 'bun:test'
import { networkTools } from '../../src/tools/network/index.js'
import { lookupBlock } from '../../src/tools/network/handlers/block.js'
import { searchBlockHeaders } from '../../src/tools/network/handlers/block-headers.js'
import { getNetworkStatus } from '../../src/tools/network/handlers/status.js'
import { chainable, fakeContext } from './fake-context.js'

describe('registry', () => {
  test('exports 4 read-only tools with output schemas and display hints', () => {
    expect(networkTools.map((t) => t.name)).toEqual([
      'get_network',
      'get_network_status',
      'lookup_block',
      'search_block_headers',
    ])
    for (const tool of networkTools) {
      expect(tool.requiresSigner ?? false).toBe(false)
      expect(tool.output).toBeDefined()
      expect(tool.view).toBeDefined()
    }
  })
})

const PAY_TXN = {
  id: 'Y5OGL6BRVN32OAL54AB32C4SXSYAZOMOT3YPIG4N454RRR566YBA',
  txType: 'pay',
  sender: 'WPR5O4HW43WM3R3RIGE7XT5QH3TSNER4VYJIGIT2CGS2SKX7P2Y724JCSQ',
  paymentTransaction: {
    amount: BigInt(250_000),
    receiver: 'L2MGM6VDPH7HME2IVMKLUYCLH5HWSZY7RQIMD5UCCTFNJ4M4DCBRXPSFJE',
  },
  innerTxns: [{}],
}

describe('lookupBlock', () => {
  test('defaults to latest round from algod and formats fields', async () => {
    const ctx = fakeContext({
      algod: { status: () => chainable({ lastRound: BigInt(100) }) },
      indexer: {
        lookupBlock: (round: number) =>
          chainable({
            round: BigInt(round),
            timestamp: BigInt(1_700_000_000),
            transactions: [PAY_TXN, {}],
            proposer: 'PROPOSER',
            feesCollected: BigInt(2_000_000),
            previousBlockHash: new Uint8Array([1, 2]),
          }),
      },
    })
    const block = await lookupBlock(ctx, {})
    expect(block.round).toBe(100)
    expect(block.transactionCount).toBe(2)
    expect(block.feesCollectedMicroAlgos).toBe(2_000_000)
    expect(block.previousBlockHash).toBe('AQI=')
    expect(block.proposerPayoutMicroAlgos).toBeUndefined()
    expect(block.transactionTypes).toEqual([
      { type: 'pay', count: 1 },
      { type: 'other', count: 1 },
    ])
  })

  test('summarizes mixed transaction types across the whole block', async () => {
    const axfer = {
      id: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      txType: 'axfer',
      sender: PAY_TXN.sender,
      assetTransferTransaction: {
        assetId: 1042,
        amount: BigInt(10),
        receiver: PAY_TXN.paymentTransaction.receiver,
      },
    }
    const ctx = fakeContext({
      indexer: {
        lookupBlock: (round: number) =>
          chainable({
            round: BigInt(round),
            timestamp: BigInt(1_700_000_000),
            transactions: [PAY_TXN, PAY_TXN, axfer],
          }),
      },
    })
    const block = await lookupBlock(ctx, { round: 22 })
    expect(block.transactionCount).toBe(3)
    expect(block.transactionTypes).toEqual([
      { type: 'pay', count: 2 },
      { type: 'axfer', count: 1 },
    ])
  })
})

describe('searchBlockHeaders', () => {
  test('caps limit at 100 and strips final page token', async () => {
    let requestedLimit = 0
    const proxyBase: unknown = new Proxy(
      {},
      {
        get(_obj, prop) {
          if (prop === 'do')
            return async () => ({
              blocks: [{ round: BigInt(5), timestamp: BigInt(1), transactions: [] }],
              nextToken: 'tok',
            })
          if (prop === 'limit')
            return (l: number) => {
              requestedLimit = l
              return proxyBase
            }
          return () => proxyBase
        },
      },
    )
    const ctx = fakeContext({ indexer: { searchForBlockHeaders: () => proxyBase } })
    const result = await searchBlockHeaders(ctx, { limit: 500 })
    expect(requestedLimit).toBe(100)
    expect(result.blocks).toHaveLength(1)
    expect(result.nextToken).toBeUndefined() // 1 < 100 → final page
  })
})

describe('getNetworkStatus', () => {
  test('computes supply, participation, and TPS from sampled blocks', async () => {
    const ctx = fakeContext({
      algod: {
        status: () =>
          chainable({
            lastRound: BigInt(20),
            timeSinceLastRound: BigInt(2_800_000_000),
            lastVersion: 'v40',
            catchupTime: BigInt(0),
          }),
        supply: () =>
          chainable({
            totalMoney: BigInt(10_000_000_000_000),
            onlineMoney: BigInt(2_000_000_000_000),
          }),
      },
      indexer: {
        lookupBlock: (round: number) =>
          chainable({
            round: BigInt(round),
            timestamp: BigInt(1_700_000_000 + round * 3),
            transactions: Array.from({ length: 30 }, () => ({})),
          }),
      },
    })
    const status = await getNetworkStatus(ctx)
    expect(status.latestRound).toBe(20)
    expect(status.totalSupplyMicroAlgos).toBe(10_000_000_000_000)
    expect(status.onlineStakeMicroAlgos).toBe(2_000_000_000_000)
    expect(status.participation).toBe(20)
    expect(status.avgBlockTime).toBe(3)
    expect(status.avgTps).toBe(10)
    expect(status.blockDetails).toHaveLength(9)
  })

  test('a genesis block at timestamp 0 does not poison the block-time average', async () => {
    const ctx = fakeContext({
      algod: {
        status: () =>
          chainable({
            lastRound: BigInt(2),
            timeSinceLastRound: BigInt(0),
            lastVersion: 'v40',
            catchupTime: BigInt(0),
          }),
        supply: () => chainable({ totalMoney: BigInt(1), onlineMoney: BigInt(1) }),
      },
      indexer: {
        lookupBlock: (round: number) => {
          if (round < 0) throw new Error('no such round')
          return chainable({
            round: BigInt(round),
            timestamp: BigInt(round === 0 ? 0 : 1_700_000_000 + round * 3),
            transactions: [],
          })
        },
      },
    })
    const status = await getNetworkStatus(ctx)
    expect(status.avgBlockTime).toBe(3)
  })

  test('zero total supply (fresh localnet) yields participation 0, not NaN', async () => {
    const ctx = fakeContext({
      algod: {
        status: () =>
          chainable({
            lastRound: BigInt(1),
            timeSinceLastRound: BigInt(0),
            lastVersion: 'v40',
            catchupTime: BigInt(0),
          }),
        supply: () => chainable({ totalMoney: BigInt(0), onlineMoney: BigInt(0) }),
      },
      indexer: {
        lookupBlock: (round: number) =>
          chainable({ round: BigInt(round), timestamp: BigInt(1_700_000_000), transactions: [] }),
      },
    })
    const status = await getNetworkStatus(ctx)
    // zod rejects NaN — an unguarded 0/0 here would throw OUTPUT_MISMATCH.
    expect(status.participation).toBe(0)
  })
})
