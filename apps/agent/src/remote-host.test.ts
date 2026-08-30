import { afterEach, describe, expect, test } from 'bun:test'

import { createFixtureResultStore, FIXTURE_SENDER, FIXTURE_TRANSACTION_ID } from '@initlabs/vibekit/views'

import { createRemoteExplorerHost } from './remote-host.js'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

function stubFetch(reply: (url: string, body: Record<string, unknown> | undefined) => unknown, status = 200) {
  const calls: Array<{ url: string; body?: Record<string, unknown> }> = []
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined
    calls.push({ url: String(url), ...(body ? { body } : {}) })
    return new Response(JSON.stringify(reply(String(url), body)), { status })
  }) as unknown as typeof fetch
  return calls
}

const fixture = createFixtureResultStore()[0]!

describe('remote explorer host', () => {
  test('reads go to /api/explorer/<tool> with the network in the body; actions to /api/explorer', async () => {
    const calls = stubFetch((url) => (url.includes('/api/explorer/') ? { result: fixture.state === 'success' ? fixture.data : {}, view: 'account.portfolio' } : { record: fixture, live: true, round: 7 }))
    const host = createRemoteExplorerHost({ network: 'mainnet' })
    await host.lookupAccount(FIXTURE_SENDER)
    await host.lookupTransaction(FIXTURE_TRANSACTION_ID)
    await host.searchTransactions({ address: FIXTURE_SENDER })
    await host.callTool('lookup_asset', { assetId: 1 })
    await host.draft('send_payment', { sender: 'a', receiver: 'b', amountMicroAlgos: 1 })
    await host.probe()
    await host.statusRound()
    expect(calls.map((call) => call.url)).toEqual([
      '/api/explorer/get_account_portfolio',
      '/api/explorer/lookup_transaction',
      '/api/explorer/search_account_transactions',
      '/api/explorer/lookup_asset',
      '/api/explorer',
      '/api/explorer?network=mainnet',
      '/api/explorer?network=mainnet',
    ])
    for (const call of calls.slice(0, 5)) expect(call.body?.network).toBe('mainnet')
    expect(calls[3]!.body).toEqual({ network: 'mainnet', assetId: 1 })
    expect(calls[4]!.body).toMatchObject({ action: 'draft', toolName: 'send_payment' })
  })

  test('a read comes back as its view record, with the call remembered for paging', async () => {
    stubFetch(() => ({ result: { assets: [], total: 0 }, view: 'asset.list' }))
    const host = createRemoteExplorerHost({ network: 'localnet' })
    const record = await host.callTool('search_assets', { limit: 2, nextToken: '2' })
    expect(record).toMatchObject({ state: 'success', toolName: 'search_assets', input: { limit: 2, nextToken: '2' } })
  })

  test('resolveName and pluginTool return the raw output', async () => {
    stubFetch(() => ({ result: { name: 'alice.algo', address: FIXTURE_SENDER } }))
    const host = createRemoteExplorerHost({ network: 'testnet' })
    expect(await host.resolveName('alice.algo')).toEqual({ name: 'alice.algo', address: FIXTURE_SENDER })
    expect(await host.pluginTool('get_asset_prices', { assetIds: [0] })).toEqual({ name: 'alice.algo', address: FIXTURE_SENDER })
  })

  test('a failed response surfaces the server message', async () => {
    stubFetch(() => ({ error: 'No tool named nope' }), 404)
    const host = createRemoteExplorerHost({ network: 'localnet' })
    await expect(host.callTool('nope', {})).rejects.toThrow('No tool named nope')
  })

  test('has no signer unless one is injected', () => {
    expect(createRemoteExplorerHost({ network: 'localnet' }).signDraft).toBeUndefined()
    const signDraft = async () => fixture
    expect(createRemoteExplorerHost({ network: 'localnet', signDraft }).signDraft).toBeDefined()
  })
})
