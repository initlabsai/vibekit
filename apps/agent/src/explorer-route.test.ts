import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import {
  createSampleHost,
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  PAYMENT_FIXTURE_SIGNED_TRANSACTION,
  type StructuredResult,
} from '@initlabs/vibekit/views'

const live = await import('@initlabs/vibekit/live')

/** Every createLiveHost call is recorded; the host answers with fixture records and a broadcast stub. */
const created: unknown[] = []
const broadcasts: StructuredResult[] = []
const sample = createSampleHost()
const pluginCalls: Array<[string, unknown]> = []
mock.module('@initlabs/vibekit/live', () => ({
  ...live,
  createEnrichmentHost: (config: unknown) => ({
    network: typeof config === 'string' ? config : (config as { id: string }).id,
    toolNames: [
      'batch_reverse_resolve_nfd',
      'get_asset_profile',
      'get_asset_prices',
      'get_live_markets',
    ],
    callTool: async (toolName: string, args: unknown) => {
      if (
        ![
          'batch_reverse_resolve_nfd',
          'get_asset_profile',
          'get_asset_prices',
          'get_live_markets',
        ].includes(toolName)
      ) {
        throw new Error(`This host has no tool named ${toolName}`)
      }
      pluginCalls.push([toolName, args])
      if (toolName === 'get_live_markets') return { markets: [], total: 0 }
      return { results: [] }
    },
    viewOf: (toolName: string) => (toolName === 'get_live_markets' ? 'arcade.markets' : undefined),
  }),
  resolveNfdName: async (network: string, name: string) => ({
    name,
    address: FIXTURE_SENDER,
    state: 'owned',
    properties: { network },
  }),
  createLiveHost: (config: unknown) => {
    created.push(config)
    const network = typeof config === 'string' ? config : (config as { id: string }).id
    return {
      ...sample,
      network,
      probe: async () => true,
      statusRound: async () => ({ lastRound: 7 }),
      callTool: async (toolName: string) => {
        if (toolName !== 'lookup_asset') throw new Error(`This host has no tool named ${toolName}`)
        return sample.lookupAsset(1)
      },
      broadcastSigned: async (record: StructuredResult) => {
        broadcasts.push(record)
        return { txid: 'TXID' }
      },
      confirmation: async () => undefined,
    }
  },
}))

const { GET, POST } = await import('../app/api/explorer/route.js')

const post = (body: unknown) =>
  POST(new Request('http://x/api/explorer', { method: 'POST', body: JSON.stringify(body) }))

async function fixtureDraft(): Promise<StructuredResult> {
  return sample.draft('send_payment', {
    sender: FIXTURE_SENDER,
    receiver: FIXTURE_RECEIVER,
    amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  })
}

const env = { ...process.env }
beforeEach(() => {
  created.length = 0
  broadcasts.length = 0
})
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]
  Object.assign(process.env, env)
})

describe('explorer route', () => {
  test('probes with GET and defaults to mainnet', async () => {
    const response = await GET(new Request('http://x/api/explorer'))
    expect(await response.json()).toEqual({ network: 'mainnet', live: true, round: 7 })
  })

  test('one host per network; localnet and mainnet do not share one', async () => {
    await post({ action: 'status-round', network: 'localnet' })
    await post({ action: 'status-round', network: 'mainnet' })
    await post({ action: 'status-round', network: 'mainnet' })
    // The GET probe above may already have built mainnet; three calls never build more than one per network.
    const byNetwork = (network: string) =>
      created.filter((c) => c === network || (c as { id?: string })?.id === network).length
    expect(byNetwork('localnet')).toBe(1)
    expect(byNetwork('mainnet')).toBeLessThanOrEqual(1)
  })

  test("a plugin read through call-tool comes back as its view's record, with the call remembered for paging", async () => {
    const response = await post({
      action: 'call-tool',
      network: 'localnet',
      toolName: 'get_live_markets',
      args: { limit: 2, nextToken: '2' },
    })
    expect(response.status).toBe(200)
    const { record } = (await response.json()) as {
      record: { state: string; toolName: string; input?: unknown; data?: unknown }
    }
    expect(record).toMatchObject({
      state: 'success',
      toolName: 'get_live_markets',
      input: { limit: 2, nextToken: '2' },
      data: { markets: [], total: 0 },
    })
    expect(pluginCalls.at(-1)).toEqual(['get_live_markets', { limit: 2, nextToken: '2' }])
    pluginCalls.length = 0
  })

  test('unknown tool names are 400, not 502', async () => {
    const response = await post({
      action: 'call-tool',
      network: 'localnet',
      toolName: 'nope',
      args: {},
    })
    expect(response.status).toBe(400)
  })

  test('production without BYO endpoints is 503 naming the variables', async () => {
    process.env.VERCEL = '1'
    delete process.env.VIBEKIT_ALGOD_TESTNET_URL
    delete process.env.VIBEKIT_INDEXER_TESTNET_URL
    // testnet has no cached host yet, so this request builds one and hits the env check.
    const response = await post({ action: 'status-round', network: 'testnet' })
    expect(response.status).toBe(503)
    expect((await response.json()).error).toContain('VIBEKIT_ALGOD_TESTNET_URL')
  })

  test('record-signed verifies the bytes wrap the draft; a mutated draft is refused', async () => {
    const draftRecord = await fixtureDraft()
    if (draftRecord.state !== 'success') throw new Error('fixture draft failed')
    const ok = await post({
      action: 'record-signed',
      network: 'localnet',
      draftRecord,
      signedTransactions: [PAYMENT_FIXTURE_SIGNED_TRANSACTION],
    })
    expect(ok.status).toBe(200)
    const { record } = (await ok.json()) as { record: StructuredResult }
    expect(record.toolName).toBe('sign_group')

    const mutated = {
      ...draftRecord,
      data: {
        ...(draftRecord.data as object),
        unsignedGroup: { transactions: ['aGVsbG8='], summary: 'tampered' },
      },
    }
    const refused = await post({
      action: 'record-signed',
      network: 'localnet',
      draftRecord: mutated,
      signedTransactions: [PAYMENT_FIXTURE_SIGNED_TRANSACTION],
    })
    expect(refused.status).toBe(400)
  })

  test('submit-signed without the draft is invalid', async () => {
    const response = await post({
      action: 'submit-signed',
      network: 'localnet',
      signedTransactions: [PAYMENT_FIXTURE_SIGNED_TRANSACTION],
    })
    expect(response.status).toBe(400)
    expect(broadcasts).toHaveLength(0)
  })

  test('submit-signed re-verifies, broadcasts, and returns pending rather than waiting', async () => {
    const draftRecord = await fixtureDraft()
    const response = await post({
      action: 'submit-signed',
      network: 'localnet',
      draftRecord,
      signedTransactions: [PAYMENT_FIXTURE_SIGNED_TRANSACTION],
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ txid: 'TXID', pending: true })
    expect(broadcasts).toHaveLength(1)

    const mismatch = await post({
      action: 'submit-signed',
      network: 'localnet',
      draftRecord,
      signedTransactions: [PAYMENT_FIXTURE_SIGNED_TRANSACTION, PAYMENT_FIXTURE_SIGNED_TRANSACTION],
    })
    expect(mismatch.status).toBe(400)
    expect(broadcasts).toHaveLength(1)
  })

  test('await-confirmation answers pending while the round is unknown', async () => {
    const response = await post({ action: 'await-confirmation', network: 'localnet', txid: 'TXID' })
    expect(await response.json()).toEqual({ pending: true })
  })

  test('oversized bodies are 413', async () => {
    const response = await post({
      action: 'probe',
      network: 'localnet',
      pad: 'x'.repeat(300 * 1024),
    })
    expect(response.status).toBe(413)
  })

  test('resolve-nfd answers on mainnet and testnet only', async () => {
    const ok = await post({ action: 'resolve-nfd', network: 'mainnet', name: 'alice.algo' })
    expect(await ok.json()).toEqual({
      nfd: {
        name: 'alice.algo',
        address: FIXTURE_SENDER,
        state: 'owned',
        properties: { network: 'mainnet' },
      },
    })
    const local = await post({ action: 'resolve-nfd', network: 'localnet', name: 'alice.algo' })
    expect(local.status).toBe(400)
  })

  test("plugin-tool runs only the enrichment plugins' tools", async () => {
    const ok = await post({
      action: 'plugin-tool',
      network: 'mainnet',
      toolName: 'batch_reverse_resolve_nfd',
      args: { addresses: [FIXTURE_SENDER] },
    })
    expect(await ok.json()).toEqual({ output: { results: [] } })
    expect(pluginCalls).toEqual([['batch_reverse_resolve_nfd', { addresses: [FIXTURE_SENDER] }]])
    const refused = await post({
      action: 'plugin-tool',
      network: 'mainnet',
      toolName: 'send_payment',
      args: {},
    })
    expect(refused.status).toBe(400)
  })
})
