import { describe, expect, test } from 'bun:test'
import { resolveNetwork } from '@initlabs/vibekit-core'
import { vestigePlugin, vestigeTools, getVestige } from '../src/index.js'

const ctxFor = (network: string, service?: unknown) =>
  ({ network: resolveNetwork(network), services: service ? { vestige: service } : {} }) as never

describe('vestige plugin', () => {
  test('exports 2 read-only tools with output schemas and views', () => {
    expect(vestigeTools.map((t) => t.name)).toEqual(['get_asset_prices', 'search_assets_ranked'])
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
    const result = (await vestigeTools[0]!.handler(ctxFor('mainnet', service), { assetIds: [0, 7] })) as {
      prices: unknown[]
    }
    expect(captured.denominating_asset_id).toBe(31566704)
    expect(result.prices).toEqual([
      { assetId: 0, priceUsd: '0.09', confidence: 1 },
      { assetId: 7, priceUsd: '0.00000004923466042154566', confidence: 0.9 },
    ])
  })
})
