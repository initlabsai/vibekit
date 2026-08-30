/** The browser's routes are mounts: the package's action routes over one live host per network, and the query handler for reads. */
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { createSampleHost, FIXTURE_RECEIVER, FIXTURE_SENDER, PAYMENT_FIXTURE_AMOUNT_MICROALGOS, PAYMENT_FIXTURE_SIGNED_TRANSACTION, type StructuredResult } from '@initlabs/vibekit/views'

const live = await import('@initlabs/vibekit/live')

/** Every createLiveHost call is recorded; the host answers with fixture records and a broadcast stub. */
const created: unknown[] = []
const broadcasts: StructuredResult[] = []
const sample = createSampleHost()
mock.module('@initlabs/vibekit/live', () => ({
  ...live,
  createLiveHost: (config: unknown) => {
    created.push(config)
    const network = typeof config === 'string' ? config : (config as { id: string }).id
    return {
      ...sample,
      network,
      statusRound: async () => ({ lastRound: 7 }),
      broadcastSigned: async (record: StructuredResult) => {
        broadcasts.push(record)
        return { txid: 'TXID' }
      },
      confirmation: async () => undefined,
    }
  },
}))

const { GET, POST } = await import('../app/api/explorer/route.js')
const reads = await import('../app/api/explorer/[name]/route.js')

const post = (body: unknown) => POST(new Request('http://x/api/explorer', { method: 'POST', body: JSON.stringify(body) }))
const read = (name: string, body: unknown) =>
  reads.POST(new Request(`http://x/api/explorer/${name}`, { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ name }) })

async function fixtureDraft(): Promise<StructuredResult> {
  return sample.draft('send_payment', { sender: FIXTURE_SENDER, receiver: FIXTURE_RECEIVER, amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS })
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

describe('explorer routes', () => {
  test('probes with GET and defaults to mainnet', async () => {
    expect(await (await GET(new Request('http://x/api/explorer'))).json()).toEqual({ network: 'mainnet', live: true, round: 7 })
    expect((await GET(new Request('http://x/api/explorer?network=moonnet'))).status).toBe(400)
  })

  test('one host per network; an unknown network is 400', async () => {
    await post({ action: 'confirmation', network: 'localnet', txid: 'T' })
    await post({ action: 'confirmation', network: 'localnet', txid: 'T' })
    expect(created.filter((c) => c === 'localnet').length).toBe(1)
    expect((await post({ action: 'confirmation', network: 'moonnet', txid: 'T' })).status).toBe(400)
  })

  test('reads: an unknown tool is 404, bad JSON is 400', async () => {
    expect((await read('nope', {})).status).toBe(404)
    expect((await reads.POST(new Request('http://x/api/explorer/lookup_asset', { method: 'POST', body: '{nope' }), { params: Promise.resolve({ name: 'lookup_asset' }) })).status).toBe(400)
  })

  test('production without BYO endpoints is 503 naming the variables', async () => {
    process.env.VERCEL = '1'
    delete process.env.VIBEKIT_ALGOD_TESTNET_URL
    delete process.env.VIBEKIT_INDEXER_TESTNET_URL
    const response = await post({ action: 'confirmation', network: 'testnet', txid: 'T' })
    expect(response.status).toBe(503)
    expect((await response.json()).error).toContain('VIBEKIT_ALGOD_TESTNET_URL')
  })

  test('record-signed verifies the bytes wrap the draft; a mutated draft is refused', async () => {
    const draftRecord = await fixtureDraft()
    if (draftRecord.state !== 'success') throw new Error('fixture draft failed')
    const ok = await post({ action: 'record-signed', network: 'localnet', draftRecord, signedTransactions: [PAYMENT_FIXTURE_SIGNED_TRANSACTION] })
    expect(ok.status).toBe(200)
    expect(((await ok.json()) as { record: StructuredResult }).record.toolName).toBe('sign_group')
    const mutated = { ...draftRecord, data: { ...(draftRecord.data as object), unsignedGroup: { transactions: ['aGVsbG8='], summary: 'tampered' } } }
    expect((await post({ action: 'record-signed', network: 'localnet', draftRecord: mutated, signedTransactions: [PAYMENT_FIXTURE_SIGNED_TRANSACTION] })).status).toBe(400)
  })

  test('submit re-verifies, broadcasts, and returns pending; without the draft it is invalid', async () => {
    expect((await post({ action: 'submit', network: 'localnet', signedTransactions: [PAYMENT_FIXTURE_SIGNED_TRANSACTION] })).status).toBe(400)
    const draftRecord = await fixtureDraft()
    const response = await post({ action: 'submit', network: 'localnet', draftRecord, signedTransactions: [PAYMENT_FIXTURE_SIGNED_TRANSACTION] })
    expect(await response.json()).toMatchObject({ txid: 'TXID', pending: true })
    expect(broadcasts).toHaveLength(1)
    const mismatch = await post({ action: 'submit', network: 'localnet', draftRecord, signedTransactions: [PAYMENT_FIXTURE_SIGNED_TRANSACTION, PAYMENT_FIXTURE_SIGNED_TRANSACTION] })
    expect(mismatch.status).toBe(400)
    expect(broadcasts).toHaveLength(1)
    expect(await (await post({ action: 'confirmation', network: 'localnet', txid: 'TXID' })).json()).toEqual({ pending: true })
  })

  test('oversized bodies are 413', async () => {
    expect((await post({ action: 'confirmation', network: 'localnet', txid: 'x'.repeat(300 * 1024) })).status).toBe(413)
  })
})
