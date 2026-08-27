import { describe, expect, test } from 'bun:test'
import type { Market, OpenOrder, Orderbook } from '@alpha-arcade/sdk'
import { alphaArcadeTools, alphaArcadePlugin } from '../../../src/plugins/alpha-arcade/index.js'
import { formatMarket, formatOpenOrder, formatOrderbook, microToUsd } from '../../../src/plugins/alpha-arcade/format.js'

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
    const ob = { yes: { bids: [entry], asks: [] }, no: { bids: [], asks: [] } } as unknown as Orderbook
    const formatted = formatOrderbook(ob)
    expect(formatted.yes.bids[0]).toEqual({ priceUsd: 0.65, quantity: 2, escrowAppId: 1, owner: 'X' })
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
  test('factory returns a ToolPlugin with service and 5 read tools', () => {
    const plugin = alphaArcadePlugin()
    expect(plugin.name).toBe('alpha-arcade')
    expect(plugin.service).toBeDefined()
    expect(plugin.tools.map((t) => t.name)).toEqual([
      'get_live_markets',
      'get_market',
      'get_orderbook',
      'get_positions',
      'get_open_orders',
    ])
    for (const tool of alphaArcadeTools) expect(tool.requiresSigner ?? false).toBe(false)
  })
})
