import { describe, expect, test } from 'bun:test'
import { resolveNetwork, type ToolContext } from '../../../src/core/index.js'
import { getNfdClient, nfdPlugin, nfdTools } from '../../../src/plugins/nfd/index.js'

function ctxWith(services: Record<string, unknown>, networkId = 'mainnet'): ToolContext {
  return {
    network: { ...resolveNetwork('mainnet'), id: networkId },
    servedNetworks: [networkId],
    defaultNetwork: networkId,
    algod: {} as ToolContext['algod'],
    indexer: {} as ToolContext['indexer'],
    mode: 'compose',
    services,
  }
}

describe('nfd plugin', () => {
  test('factory returns ToolPlugin: name=nfd, 4 read tools, service present', () => {
    const plugin = nfdPlugin()
    expect(plugin.name).toBe('nfd')
    expect(plugin.tools.map((t) => t.name)).toEqual([
      'resolve_nfd',
      'reverse_resolve_nfd',
      'batch_reverse_resolve_nfd',
      'search_nfds',
    ])
    for (const tool of nfdTools) {
      expect(tool.requiresSigner ?? false).toBe(false)
      expect(tool.output).toBeDefined()
    }
  })

  test('accessor throws PLUGIN_NOT_CONFIGURED without registration', () => {
    expect(() => getNfdClient(ctxWith({}))).toThrow(/not registered/)
  })

  test('service rejects unsupported networks, caches per network', () => {
    const plugin = nfdPlugin()
    const ctx = ctxWith({ nfd: plugin.service }, 'localnet')
    expect(() => getNfdClient(ctx)).toThrow(/not available on localnet/)

    const mainnetCtx = ctxWith({ nfd: plugin.service }, 'mainnet')
    const a = getNfdClient(mainnetCtx)
    const b = getNfdClient(mainnetCtx)
    expect(a).toBe(b)
  })

  test('resolve_nfd shapes the SDK response (fake client)', async () => {
    const fakeClient = {
      resolve: async () => ({
        name: 'gabe.algo',
        depositAccount: 'DEPOSIT',
        owner: 'OWNER',
        appID: 123,
        state: 'owned',
        properties: {
          verified: { twitter: '@gabe', avatar: 'ipfs://Qm123' },
          userDefined: { bio: 'builder' },
        },
      }),
    }
    const service = { clientFor: () => fakeClient as never }
    const tool = nfdTools.find((t) => t.name === 'resolve_nfd')!
    const result = (await tool.handler(ctxWith({ nfd: service }), {
      name: 'GABE.algo',
    } as never)) as {
      address: string
      properties?: Record<string, string>
    }
    expect(result.address).toBe('DEPOSIT')
    expect(result.properties?.twitter).toBe('@gabe')
    expect(result.properties?.avatar).toBe('https://images.nf.domains/ipfs/Qm123')
    expect(result.properties?.bio).toBe('builder')
  })

  test('reverse lookups return name:null for unnamed addresses (API sends an empty object, not a missing key)', async () => {
    const fakeClient = {
      // What the live API does for an address with no NFD: an entry that is {}.
      reverseLookup: async () => ({ NAMED: { name: 'gabe.algo', appID: 5 }, UNNAMED: {} }),
    }
    const service = { clientFor: () => fakeClient as never }
    const ctx = ctxWith({ nfd: service })

    const single = nfdTools.find((t) => t.name === 'reverse_resolve_nfd')!
    const singleResult = await single.handler(ctx, { address: 'UNNAMED' } as never)
    expect(single.output!.safeParse(singleResult).success).toBe(true)
    expect((singleResult as { name: string | null }).name).toBeNull()

    const batch = nfdTools.find((t) => t.name === 'batch_reverse_resolve_nfd')!
    const batchResult = (await batch.handler(ctx, {
      addresses: ['NAMED', 'UNNAMED'],
    } as never)) as { results: Array<{ address: string; name: string | null }> }
    expect(batch.output!.safeParse(batchResult).success).toBe(true)
    expect(batchResult.results).toEqual([
      { address: 'NAMED', name: 'gabe.algo' },
      { address: 'UNNAMED', name: null },
    ])
  })

  test('search_nfds searches by substring and maps names with their asking price', async () => {
    let captured: unknown
    const fakeClient = {
      search: async (options: unknown) => {
        captured = options
        return {
          total: 2,
          nfds: [
            {
              name: 'alice.algo',
              owner: 'OWNER',
              depositAccount: 'DEPOSIT',
              state: 'forSale',
              sellAmount: 5_000_000n,
            },
            { name: 'alicia.algo', owner: 'OTHER', state: 'owned' },
          ],
        }
      },
    }
    const service = { clientFor: () => fakeClient as never }
    const ctx = ctxWith({ nfd: service })
    const tool = nfdTools.find((t) => t.name === 'search_nfds')!
    const result = (await tool.handler(ctx, { query: 'Ali.algo', forSale: true })) as {
      total: number
      nfds: Array<Record<string, unknown>>
    }
    expect(captured).toMatchObject({ substring: 'ali', limit: 10, state: ['forSale'] })
    expect(result.total).toBe(2)
    expect(result.nfds[0]).toMatchObject({
      name: 'alice.algo',
      address: 'DEPOSIT',
      sellAmountMicroAlgos: 5_000_000,
    })
    expect(result.nfds[1]!.sellAmountMicroAlgos).toBeUndefined()
  })
})
