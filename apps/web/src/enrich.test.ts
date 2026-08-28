import { describe, expect, test } from 'bun:test'

import { FIXTURE_RECEIVER, FIXTURE_SENDER } from '@initlabs/vibekit-explorer'

import { createEnrichment } from './enrich.js'
import type { RemoteExplorerHost } from './remote-host.js'

function fakeHost(network: string, answer: (tool: string, args: Record<string, unknown>) => unknown) {
  const calls: Array<[string, Record<string, unknown>]> = []
  const host = {
    network,
    pluginTool: async (tool: string, args: Record<string, unknown>) => {
      calls.push([tool, args])
      return answer(tool, args)
    },
  } as unknown as RemoteExplorerHost
  return { host, calls }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

describe('enrichment cache', () => {
  test('names batch into one reverse lookup and settle to a name or null', async () => {
    const { host, calls } = fakeHost('mainnet', () => ({
      results: [
        { address: FIXTURE_SENDER, name: 'alice.algo', avatar: 'https://x/a.png' },
        { address: FIXTURE_RECEIVER, name: null },
      ],
    }))
    const enrichment = createEnrichment(host, () => true)
    let wakes = 0
    enrichment.subscribe(() => (wakes += 1))
    expect(enrichment.profile(FIXTURE_SENDER)).toBeUndefined()
    expect(enrichment.profile(FIXTURE_RECEIVER)).toBeUndefined()
    expect(enrichment.profile(FIXTURE_SENDER)).toBeUndefined()
    await tick()
    expect(calls).toEqual([['batch_reverse_resolve_nfd', { addresses: [FIXTURE_SENDER, FIXTURE_RECEIVER] }]])
    expect(enrichment.profile(FIXTURE_SENDER)).toEqual({ name: 'alice.algo', avatar: 'https://x/a.png' })
    expect(enrichment.profile(FIXTURE_RECEIVER)).toBeNull()
    expect(wakes).toBeGreaterThan(0)
  })

  test('asset profiles and prices merge; nothing is asked off mainnet or off live', async () => {
    const { host, calls } = fakeHost('mainnet', (tool) =>
      tool === 'get_asset_prices'
        ? { prices: [{ assetId: 31566704, priceUsd: '1.0', confidence: 0.99 }] }
        : { verificationTier: 'trusted', logoUrl: 'https://x/usdc.png', name: 'USDC' },
    )
    const enrichment = createEnrichment(host, () => true)
    expect(enrichment.asset(31566704, true)).toBeUndefined()
    await tick()
    await tick()
    expect(enrichment.asset(31566704)).toEqual({ priceUsd: 1, tier: 'trusted', logoUrl: 'https://x/usdc.png', name: 'USDC' })
    expect(calls.map(([tool]) => tool).sort()).toEqual(['get_asset_prices', 'get_asset_profile'])

    const testnet = fakeHost('testnet', () => ({}))
    expect(createEnrichment(testnet.host, () => true).asset(1, true)).toBeUndefined()
    const offline = fakeHost('mainnet', () => ({}))
    expect(createEnrichment(offline.host, () => false).profile(FIXTURE_SENDER)).toBeUndefined()
    await tick()
    expect(testnet.calls).toEqual([])
    expect(offline.calls).toEqual([])
  })

  test('a price-only ask never calls get_asset_profile; a profile ask calls it once', async () => {
    const { host, calls } = fakeHost('mainnet', (tool) =>
      tool === 'get_asset_prices' ? { prices: [] } : { verificationTier: 'verified' },
    )
    const enrichment = createEnrichment(host, () => true)
    enrichment.asset(1)
    enrichment.asset(2)
    await tick()
    expect(calls.map(([tool]) => tool)).toEqual(['get_asset_prices'])
    enrichment.asset(1, true)
    enrichment.asset(1, true)
    await tick()
    await tick()
    expect(calls.filter(([tool]) => tool === 'get_asset_profile')).toHaveLength(1)
  })
})
