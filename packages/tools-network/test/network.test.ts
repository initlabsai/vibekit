import { describe, expect, test } from 'bun:test'
import { networkTools } from '../src/index.js'
import { lookupBlock } from '../src/handlers/block.js'
import { searchBlockHeaders } from '../src/handlers/block-headers.js'
import { getNetworkStatus } from '../src/handlers/status.js'
import { chainable, fakeContext } from './fake-context.js'

describe('registry', () => {
  test('exports 3 read-only tools with output schemas and display hints', () => {
    expect(networkTools.map((t) => t.name)).toEqual([
      'get_network_status',
      'lookup_block',
      'search_block_headers',
    ])
    for (const tool of networkTools) {
      expect(tool.requiresSigner ?? false).toBe(false)
      expect(tool.output).toBeDefined()
      expect(tool.display).toBeDefined()
    }
  })
})

describe('lookupBlock', () => {
  test('defaults to latest round from algod and formats fields', async () => {
    const ctx = fakeContext({
      algod: { status: () => chainable({ lastRound: BigInt(100) }) },
      indexer: {
        lookupBlock: (round: number) =>
          chainable({
            round: BigInt(round),
            timestamp: BigInt(1_700_000_000),
            transactions: [{}, {}],
            proposer: 'PROPOSER',
            feesCollected: BigInt(2_000_000),
            previousBlockHash: new Uint8Array([1, 2]),
          }),
      },
    })
    const block = await lookupBlock(ctx, {})
    expect(block.round).toBe(100)
    expect(block.transactionCount).toBe(2)
    expect(block.feesCollected).toBe(2)
    expect(block.previousBlockHash).toBe('AQI=')
    expect(block.proposerPayout).toBeUndefined()
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
          chainable({ totalMoney: BigInt(10_000_000_000_000), onlineMoney: BigInt(2_000_000_000_000) }),
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
    expect(status.totalSupply).toBe(10_000_000)
    expect(status.onlineStake).toBe(2_000_000)
    expect(status.participation).toBe(20)
    expect(status.avgBlockTime).toBe(3)
    expect(status.avgTps).toBe(10)
    expect(status.blockDetails).toHaveLength(9)
  })
})
