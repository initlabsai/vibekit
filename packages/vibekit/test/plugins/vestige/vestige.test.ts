import { describe, expect, test } from 'bun:test'
import { resolveNetwork, type NetworkId } from '../../../src/core/index.js'
import { vestigePlugin, vestigeTools, getVestige } from '../../../src/plugins/vestige/index.js'

const ctxFor = (network: NetworkId, service?: unknown) =>
  ({ network: resolveNetwork(network), services: service ? { vestige: service } : {} }) as never

describe('vestige plugin', () => {
  test('exports 4 read-only tools with output schemas and views', () => {
    expect(vestigeTools.map((t) => t.name)).toEqual([
      'get_asset_prices',
      'search_assets_ranked',
      'get_asset_price_history',
      'get_defi_overview',
    ])
    for (const tool of vestigeTools) {
      expect(tool.requiresSigner ?? false).toBe(false)
      expect(tool.output).toBeDefined()
      expect(tool.view).toBeDefined()
    }
  })

  test('mainnet-only and unregistered guards throw ToolErrors', () => {
    expect(() => getVestige(ctxFor('mainnet'))).toThrow('not registered')
    expect(() => getVestige(ctxFor('localnet', vestigePlugin().service))).toThrow('mainnet only')
  })

  test('get_asset_prices maps wire rows and denominates in USDC', async () => {
    let captured: Record<string, string | number> = {}
    const service = {
      get: async (_path: string, params: Record<string, string | number>) => {
        captured = params
        return [
          { asset_id: 0, price: 0.09, confidence: 1, total_lockup: 1 },
          { asset_id: 7, price: 4.923466042154566e-8, confidence: 0.9, total_lockup: 1 },
        ]
      },
    }
    const result = (await vestigeTools[0]!.handler(ctxFor('mainnet', service), {
      assetIds: [0, 7],
    })) as {
      prices: unknown[]
    }
    expect(captured.denominating_asset_id).toBe(31566704)
    expect(result.prices).toEqual([
      { assetId: 0, priceUsd: '0.09', confidence: 1 },
      { assetId: 7, priceUsd: '0.00000004923466042154566', confidence: 0.9 },
    ])
  })

  test('get_asset_price_history picks the interval per range and maps candles', async () => {
    let captured: { path: string; params: Record<string, string | number> } | undefined
    const service = {
      get: async (path: string, params: Record<string, string | number>) => {
        captured = { path, params }
        return [
          { timestamp: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10, confidence: 0.9 },
        ]
      },
    }
    const tool = vestigeTools.find((t) => t.name === 'get_asset_price_history')!
    const result = (await tool.handler(ctxFor('mainnet', service), {
      assetId: 0,
      range: '30d',
    })) as {
      intervalSeconds: number
      candles: unknown[]
    }
    expect(captured?.path).toBe('/assets/0/candles')
    expect(captured?.params.interval).toBe(14400)
    expect(captured?.params.denominating_asset_id).toBe(31566704)
    expect(result.intervalSeconds).toBe(14400)
    expect(result.candles).toEqual([
      { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volumeUsd: 10, confidence: 0.9 },
    ])
  })

  test('get_defi_overview converts ALGO-denominated TVL to USD and drops liquid-staking rows', async () => {
    // /protocols reports tvl in ALGO with no denominating param, and its LST rows
    // count both the backing ALGO and the minted derivative — the $715M bug.
    const service = {
      get: async (path: string) =>
        path === '/assets/price'
          ? [{ asset_id: 0, price: 0.1, confidence: 1 }]
          : [
              { id: 1, name: 'Tinyman', version: '1.1', url: 'https://tinyman.org', tvl: 5, type: 0, active: true },
              { id: 2, name: 'Tinyman', version: '2.0', url: 'https://tinyman.org', tvl: 50, type: 0, active: true },
              { id: 3, name: 'Pact', version: '1.0', url: null, tvl: 20, type: 0, active: false },
              { id: 14, name: 'xALGO LST', version: '1.0', url: null, tvl: 5000, type: 2, active: true },
            ],
    }
    const tool = vestigeTools.find((t) => t.name === 'get_defi_overview')!
    const result = (await tool.handler(ctxFor('mainnet', service), {})) as {
      totalTvlUsd: number
      protocols: Array<{ id: number; tvlUsd: number }>
    }
    expect(result.totalTvlUsd).toBeCloseTo(7.5)
    expect(result.protocols.map((p) => p.id)).toEqual([2, 3, 1])
    expect(result.protocols[0]?.tvlUsd).toBeCloseTo(5)
  })

  test('get_defi_overview refuses to report TVL without an ALGO/USD price', async () => {
    const service = {
      get: async (path: string) => (path === '/assets/price' ? [] : []),
    }
    const tool = vestigeTools.find((t) => t.name === 'get_defi_overview')!
    expect(tool.handler(ctxFor('mainnet', service), {})).rejects.toThrow('ALGO/USD price unavailable')
  })
})
