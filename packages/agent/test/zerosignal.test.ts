import { describe, expect, test } from 'bun:test'

import { createModel, isProviderConfig } from '../src/provider.js'
import {
  listZeroSignalModels,
  probeZeroSignal,
  ZEROSIGNAL_DEFAULT_BASE_URL,
  zeroSignalBaseUrl,
  zeroSignalSetupHint,
} from '../src/zerosignal.js'

describe('zeroSignalBaseUrl', () => {
  const env = { XDG_CONFIG_HOME: '/cfg' }
  test('follows the address the daemon wrote', () => {
    const read = (path: string) => {
      expect(path).toBe('/cfg/zerosignal/daemon.json')
      return JSON.stringify({ listen: '127.0.0.1:9376' })
    }
    expect(zeroSignalBaseUrl(env, read)).toBe('http://127.0.0.1:9376/v1')
    expect(zeroSignalBaseUrl(env, () => JSON.stringify({ listen: '0.0.0.0:8080' }))).toBe('http://127.0.0.1:8080/v1')
  })
  test('falls back to the default when the file is absent or malformed', () => {
    expect(zeroSignalBaseUrl(env, () => { throw new Error('ENOENT') })).toBe(ZEROSIGNAL_DEFAULT_BASE_URL)
    expect(zeroSignalBaseUrl(env, () => '{bad')).toBe(ZEROSIGNAL_DEFAULT_BASE_URL)
    expect(zeroSignalBaseUrl(env, () => JSON.stringify({ listen: 'nonsense' }))).toBe(ZEROSIGNAL_DEFAULT_BASE_URL)
  })
  test('the hint names the address it tried', () => {
    expect(zeroSignalSetupHint('http://127.0.0.1:9376/v1')).toContain('not running at http://127.0.0.1:9376/v1')
  })
})

function fakeFetch(byPath: Record<string, { status: number; body?: unknown }>): typeof fetch {
  return (async (input: URL | RequestInfo) => {
    const url = String(input)
    const match = Object.entries(byPath).find(([path]) => url.endsWith(path))
    if (!match) throw new Error(`unexpected fetch: ${url}`)
    const [, reply] = match
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
    })
  }) as typeof fetch
}

describe('zerosignal provider', () => {
  test('creates a model with wallet-admission defaults (no key or baseUrl needed)', () => {
    const config = { provider: 'zerosignal' as const, model: 'llama-3.3-70b' }
    expect(isProviderConfig(config)).toBe(true)
    expect(createModel(config)).toBeDefined()
  })

  test('probe hits /healthz at the server root, not under /v1', async () => {
    let probed = ''
    const ok = await probeZeroSignal(ZEROSIGNAL_DEFAULT_BASE_URL, (async (input: URL | RequestInfo) => {
      probed = String(input)
      return new Response(null, { status: 200 })
    }) as typeof fetch)
    expect(ok).toBe(true)
    expect(probed).toBe('http://localhost:8080/healthz')
  })

  test('probe is false when the daemon is down', async () => {
    const down = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    expect(await probeZeroSignal(undefined, down)).toBe(false)
  })

  test('lists concrete model ids from the live catalog', async () => {
    const models = await listZeroSignalModels(
      undefined,
      fakeFetch({
        '/v1/models': { status: 200, body: { data: [{ id: 'llama-3.3-70b' }, { id: 'qwen3-235b' }, { id: 7 }] } },
      }),
    )
    expect(models).toEqual(['llama-3.3-70b', 'qwen3-235b'])
  })

  test('a failed catalog fetch carries the setup hint', async () => {
    await expect(
      listZeroSignalModels(undefined, fakeFetch({ '/v1/models': { status: 502 } })),
    ).rejects.toThrow(/zs-proxy/)
  })
})
