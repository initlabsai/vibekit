import { describe, expect, test } from 'bun:test'

import { ToolError } from '@initlabs/vibekit-core'
import {
  createFundTestnetTool,
  DISPENSER_SECRET_ID,
  getValidAccessToken,
  hasDispenserToken,
  loadDispenserToken,
  saveDispenserToken,
  type DispenserToken,
  type SecretsLike,
} from '../src/dispenser.js'

function fakeSecrets(): SecretsLike & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    put: async (value, options) => {
      const id = options?.id ?? crypto.randomUUID()
      if (store.has(id)) throw new Error('exists')
      store.set(id, typeof value === 'string' ? value : new TextDecoder().decode(value))
      return id
    },
    get: async (id) => {
      const value = store.get(id)
      if (value === undefined) throw new Error('not found')
      return new TextEncoder().encode(value)
    },
    list: async () => [...store.keys()].map((id) => ({ id })),
    remove: async (id) => {
      store.delete(id)
    },
  }
}

type FetchCall = { url: string; body: string | undefined; headers: Record<string, string> }

function fakeFetch(routes: Array<(call: FetchCall) => { status: number; json: unknown } | null>) {
  const calls: FetchCall[] = []
  const fetchFn = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const call: FetchCall = {
      url: String(url),
      body: init?.body ? String(init.body) : undefined,
      headers: Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {})),
    }
    calls.push(call)
    for (const route of routes) {
      const hit = route(call)
      if (hit) {
        return new Response(JSON.stringify(hit.json), { status: hit.status })
      }
    }
    throw new Error(`Unrouted fetch: ${call.url}`)
  }) as typeof fetch
  return { fetchFn, calls }
}

const validToken: DispenserToken = {
  accessToken: 'live-token',
  refreshToken: 'refresh-1',
  expiresAt: Date.now() + 3_600_000,
}

describe('token custody', () => {
  test('save/load/has roundtrip through the secrets store', async () => {
    const secrets = fakeSecrets()
    expect(await hasDispenserToken(secrets)).toBe(false)
    await saveDispenserToken(secrets, validToken)
    expect(await hasDispenserToken(secrets)).toBe(true)
    expect(await loadDispenserToken(secrets)).toEqual(validToken)
    // save again — replaces rather than erroring on duplicate id
    await saveDispenserToken(secrets, { ...validToken, accessToken: 'v2' })
    expect((await loadDispenserToken(secrets))!.accessToken).toBe('v2')
    expect(secrets.store.size).toBe(1)
    expect([...secrets.store.keys()]).toEqual([DISPENSER_SECRET_ID])
  })

  test('no token → DISPENSER_NOT_CONFIGURED', async () => {
    const secrets = fakeSecrets()
    expect(getValidAccessToken(secrets)).rejects.toMatchObject({ code: 'DISPENSER_NOT_CONFIGURED' })
  })

  test('expired without refresh token → DISPENSER_TOKEN_EXPIRED', async () => {
    const secrets = fakeSecrets()
    await saveDispenserToken(secrets, { accessToken: 'stale', expiresAt: Date.now() - 1000 })
    expect(getValidAccessToken(secrets)).rejects.toMatchObject({ code: 'DISPENSER_TOKEN_EXPIRED' })
  })

  test('expired with refresh token → refreshes and re-seals', async () => {
    const secrets = fakeSecrets()
    await saveDispenserToken(secrets, { ...validToken, expiresAt: Date.now() - 1000 })
    const { fetchFn, calls } = fakeFetch([
      (call) =>
        call.url.includes('/oauth/token') && call.body?.includes('grant_type=refresh_token')
          ? { status: 200, json: { access_token: 'refreshed', expires_in: 86400 } }
          : null,
    ])
    expect(await getValidAccessToken(secrets, fetchFn)).toBe('refreshed')
    const saved = await loadDispenserToken(secrets)
    expect(saved!.accessToken).toBe('refreshed')
    expect(saved!.refreshToken).toBe('refresh-1') // kept when Auth0 does not rotate
    expect(calls).toHaveLength(1)
  })
})

describe('fund_testnet_account', () => {
  test('funds with the sealed token; plaintext never in the result', async () => {
    const secrets = fakeSecrets()
    await saveDispenserToken(secrets, validToken)
    const { fetchFn, calls } = fakeFetch([
      (call) =>
        call.url.endsWith('/fund/0')
          ? { status: 200, json: { txID: 'TX123', amount: 1_000_000 } }
          : null,
    ])
    const tool = createFundTestnetTool(secrets, fetchFn)
    expect(tool.requiresSigner).toBe(true)

    const result = await tool.handler({} as never, { receiver: 'ADDR' } as never)
    expect(result).toEqual({ txId: 'TX123', receiver: 'ADDR', amountMicroAlgos: 1_000_000 })
    expect(JSON.stringify(result)).not.toContain('live-token')
    expect(calls[0]!.headers.Authorization).toBe('Bearer live-token')
    expect(JSON.parse(calls[0]!.body!)).toEqual({ receiver: 'ADDR', amount: 1_000_000, assetID: 0 })
  })

  test('401 → one transparent refresh + retry', async () => {
    const secrets = fakeSecrets()
    await saveDispenserToken(secrets, validToken)
    let fundCalls = 0
    const { fetchFn } = fakeFetch([
      (call) => {
        if (call.url.endsWith('/fund/0')) {
          fundCalls++
          return fundCalls === 1
            ? { status: 401, json: {} }
            : { status: 200, json: { txID: 'TX2', amount: 5 } }
        }
        return null
      },
      (call) =>
        call.url.includes('/oauth/token')
          ? { status: 200, json: { access_token: 'fresh', expires_in: 86400 } }
          : null,
    ])
    const tool = createFundTestnetTool(secrets, fetchFn)
    const result = (await tool.handler({} as never, { receiver: 'A', amountMicroAlgos: 5 } as never)) as {
      txId: string
    }
    expect(result.txId).toBe('TX2')
    expect(fundCalls).toBe(2)
  })

  test('limit responses become DISPENSER_LIMIT', async () => {
    const secrets = fakeSecrets()
    await saveDispenserToken(secrets, validToken)
    const { fetchFn } = fakeFetch([
      (call) =>
        call.url.endsWith('/fund/0')
          ? { status: 429, json: { message: 'daily limit reached' } }
          : null,
    ])
    const tool = createFundTestnetTool(secrets, fetchFn)
    expect(tool.handler({} as never, { receiver: 'A' } as never)).rejects.toMatchObject({
      code: 'DISPENSER_LIMIT',
    })
  })
})
