import { describe, expect, test } from 'bun:test'
import type { Market, OpenOrder, Orderbook } from '@alpha-arcade/sdk'
import { alphaArcadeTools, alphaArcadePlugin } from '../../../src/plugins/alpha-arcade/index.js'
import {
  formatMarket,
  formatOpenOrder,
  formatOrderbook,
  microToUsd,
} from '../../../src/plugins/alpha-arcade/format.js'

describe('REFACTOR.md §1 semantics', () => {
  test('microToUsd returns raw numbers, no $ strings', () => {
    expect(microToUsd(650_000)).toBe(0.65)
  })

  test('formatMarket exposes both prob and Usd fields, renames volume/rewards', () => {
    const market = {
      id: 'm1',
      title: 'Test',
      yesProb: 0.65,
      noProb: 0.35,
      volume: 12345.5,
      totalRewards: 100,
      rewardsPaidOut: 40,
      lastRewardAmount: 5,
      options: [{ id: 'o1', title: 'A', marketAppId: 1, yesProb: 0.2, noProb: 0.8 }],
    } as unknown as Market
    const formatted = formatMarket(market)
    expect(formatted.yesPriceUsd).toBe(0.65)
    expect(formatted.yesProb).toBe(0.65)
    expect(formatted.noPriceUsd).toBe(0.35)
    expect(formatted.volumeUsd).toBe(12345.5)
    expect(formatted.totalRewardsUsd).toBe(100)
    expect(formatted.rewardsPaidOutUsd).toBe(40)
    expect(formatted.lastRewardAmountUsd).toBe(5)
    expect(formatted.options?.[0]?.yesPriceUsd).toBe(0.2)
    expect('yesPrice' in formatted).toBe(false)
  })

  test('formatOrderbook: priceUsd numbers from microunits', () => {
    const entry = { price: 650_000, quantity: 2_000_000, escrowAppId: 1, owner: 'X' }
    const ob = {
      yes: { bids: [entry], asks: [] },
      no: { bids: [], asks: [] },
    } as unknown as Orderbook
    const formatted = formatOrderbook(ob)
    expect(formatted.yes.bids[0]).toEqual({
      priceUsd: 0.65,
      quantity: 2,
      escrowAppId: 1,
      owner: 'X',
    })
  })

  test('formatOpenOrder converts slippage (the v1 bug) and maps enums', () => {
    const order = {
      escrowAppId: 9,
      marketAppId: 1,
      position: 1,
      side: 2,
      price: 500_000,
      quantity: 1_000_000,
      quantityFilled: 0,
      slippage: 20_000,
      owner: 'X',
    } as unknown as OpenOrder
    const formatted = formatOpenOrder(order)
    expect(formatted.position).toBe('YES')
    expect(formatted.side).toBe('SELL')
    expect(formatted.priceUsd).toBe(0.5)
    expect(formatted.slippageUsd).toBe(0.02)
  })
})

describe('plugin shape', () => {
  test('factory returns a ToolPlugin with service, 5 reads, and 3 writes', () => {
    const plugin = alphaArcadePlugin()
    expect(plugin.name).toBe('alpha-arcade')
    expect(plugin.service).toBeDefined()
    expect(plugin.tools.map((t) => t.name)).toEqual([
      'get_live_markets',
      'get_market',
      'get_orderbook',
      'get_positions',
      'get_open_orders',
      'place_order',
      'cancel_order',
      'claim_winnings',
    ])
    for (const tool of alphaArcadeTools.slice(0, 5))
      expect(tool.requiresSigner ?? false).toBe(false)
  })

  test('every read declares an arcade view with a schema; writes compose for a signer', () => {
    const plugin = alphaArcadePlugin()
    expect(alphaArcadeTools.filter((t) => t.requiresSigner).map((t) => t.name)).toEqual([
      'place_order',
      'cancel_order',
      'claim_winnings',
    ])
    for (const tool of alphaArcadeTools) {
      if (tool.requiresSigner) {
        expect(tool.view).toBe('txn')
        expect(tool.description.length).toBeLessThanOrEqual(200)
        continue
      }
      expect(tool.view?.startsWith('arcade.')).toBe(true)
      expect(plugin.views?.[tool.view!]).toBeDefined()
      expect(tool.output).toBeDefined()
      expect(tool.description.length).toBeLessThanOrEqual(200)
    }
  })

  test('place_order captures the group the SDK built and never submits it', async () => {
    const { resolveNetwork } = await import('../../../src/core/index.js')
    const algosdk = (await import('algosdk')).default
    const user = algosdk.generateAccount()
    const params = {
      fee: 1000,
      firstValid: 1,
      lastValid: 1001,
      genesisID: 'test',
      genesisHash: new Uint8Array(32),
      minFee: 1000,
    }
    const leg = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: user.addr,
      receiver: user.addr,
      amount: 1,
      suggestedParams: params,
    })
    let submitted = false
    const service = {
      read: {
        getMarketFromApi: async () => ({
          marketAppId: 7,
          title: 'Rain tomorrow?',
          yesProb: 0.65,
          noProb: 0.35,
          yesAssetId: 1,
          noAssetId: 2,
        }),
      },
      trading: (
        _address: string,
        signer: (txns: unknown[], indexes: number[]) => Promise<unknown>,
      ) => ({
        createLimitOrder: async () => {
          await signer([leg], [0])
          submitted = true
          return { txIds: [], confirmedRound: 0 }
        },
      }),
    }
    const ctx = {
      network: resolveNetwork('mainnet'),
      services: { 'alpha-arcade': service },
      mode: 'compose',
    } as never
    const tool = alphaArcadeTools.find((t) => t.name === 'place_order')!
    const result = (await tool.handler(ctx, {
      marketId: '7',
      side: 'yes',
      action: 'buy',
      quantity: 50,
      priceUsd: 0.65,
      sender: user.addr.toString(),
    })) as {
      unsignedGroup: string[]
      intent: Record<string, unknown>
      summary: string
    }
    expect(submitted).toBe(false)
    expect(result.unsignedGroup).toHaveLength(1)
    expect(result.intent).toMatchObject({
      kind: 'order',
      side: 'yes',
      action: 'buy',
      orderType: 'limit',
      priceUsd: 0.65,
      quantity: 50,
      totalUsd: 32.5,
    })
    expect(result.summary).toContain('buy 50 YES @ $0.65')
  })

  test('the cached feed: a single option is the market, several are its options, probabilities scale from microunits', async () => {
    const { marketFromCachedFeed } = await import('../../../src/plugins/alpha-arcade/format.js')
    const feed = (await import('./live-markets-cached.json')).default as {
      markets: Parameters<typeof marketFromCachedFeed>[0][]
    }
    const [single, multi] = feed.markets.map((raw) => formatMarket(marketFromCachedFeed(raw)!))
    expect(single!.marketAppId).toBeGreaterThan(0)
    expect(single!.yesPriceUsd).toBeGreaterThan(0)
    expect(single!.yesPriceUsd).toBeLessThan(1)
    expect(single!.endTs).toBeLessThan(1e10)
    expect(single!.options).toBeUndefined()
    expect(multi!.options?.length).toBeGreaterThan(1)
    expect(multi!.options?.[0]?.yesPriceUsd).toBeLessThan(1)
    expect(multi!.yesPriceUsd).toBeUndefined()
  })

  test('cachedFeed pages through lastEvaluatedKey and drops hidden markets', async () => {
    const { cachedFeed } = await import('../../../src/plugins/alpha-arcade/index.js')
    const feed = (await import('./live-markets-cached.json')).default
    const calls: string[] = []
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      calls.push(String(url))
      const second = String(url).includes('lastEvaluatedKey')
      const body = second
        ? { markets: [{ ...feed.markets[0], id: 'hidden-one', hidden: true }] }
        : feed
      return new Response(JSON.stringify(body), { status: 200 })
    }) as never
    try {
      const markets = await cachedFeed('k', 'https://example.test/api')
      expect(calls).toHaveLength(2)
      expect(calls[1]).toContain('lastEvaluatedKey=eyJvZmZzZXQiOjMwM30%3D')
      expect(markets.map((m) => m.id)).toEqual(feed.markets.map((m) => m.id))
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
