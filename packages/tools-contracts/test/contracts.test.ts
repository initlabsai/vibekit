import { describe, expect, test } from 'bun:test'
import { ToolError } from '@initlabs/vibekit-core'
import { contractTools } from '../src/index.js'
import { lookupApplication, lookupApplicationLogs } from '../src/handlers/lookup.js'
import { searchApplications } from '../src/handlers/search.js'
import { readBoxState, readGlobalState, readLocalState } from '../src/handlers/state.js'
import { chainable, fakeContext } from './fake-context.js'

const utf8 = (s: string) => new TextEncoder().encode(s)

/** A realistic indexer application model with bigint-bearing fields. */
const fakeIndexerApp = {
  id: BigInt(123),
  params: {
    creator: 'CREATORADDRESS',
    globalState: [
      {
        key: utf8('counter'),
        value: { type: 2, bytes: new Uint8Array(), uint: BigInt(42) },
      },
      {
        key: utf8('owner'),
        value: { type: 1, bytes: utf8('hello'), uint: BigInt(0) },
      },
    ],
    localStateSchema: { numByteSlice: BigInt(1), numUint: BigInt(2) },
    globalStateSchema: { numByteSlice: BigInt(3), numUint: BigInt(4) },
  },
}

describe('registry', () => {
  test('exports 6 read-only tools with output schemas and display hints', () => {
    expect(contractTools.map((t) => t.name)).toEqual([
      'lookup_application',
      'search_applications',
      'lookup_application_logs',
      'read_global_state',
      'read_local_state',
      'read_box_state',
    ])
    for (const tool of contractTools) {
      expect(tool.requiresSigner ?? false).toBe(false)
      expect(tool.output).toBeDefined()
      expect(tool.display).toBeDefined()
    }
  })
})

describe('lookupApplication', () => {
  test('formats application with base64 state keys and numeric schemas', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupApplications: (id: number) => {
          expect(id).toBe(123)
          return chainable({ application: fakeIndexerApp })
        },
      },
    })
    const app = await lookupApplication(ctx, { applicationId: 123 })
    expect(app.applicationId).toBe(123)
    expect(app.creator).toBe('CREATORADDRESS')
    expect(app.globalState).toHaveLength(2)
    expect(app.globalState![0]).toEqual({
      key: btoa('counter'),
      value: { type: 2, bytes: '', uint: 42 },
    })
    expect(app.globalState![1]!.value.bytes).toBe(btoa('hello'))
    expect(app.localStateSchema).toEqual({ numByteSlice: 1, numUint: 2 })
    expect(app.globalStateSchema).toEqual({ numByteSlice: 3, numUint: 4 })
  })
})

describe('searchApplications', () => {
  test('caps limit at 100 and strips final page token', async () => {
    let requestedLimit = 0
    let requestedCreator = ''
    const proxyBase: unknown = new Proxy(
      {},
      {
        get(_obj, prop) {
          if (prop === 'do')
            return async () => ({ applications: [fakeIndexerApp], nextToken: 'tok' })
          if (prop === 'limit')
            return (l: number) => {
              requestedLimit = l
              return proxyBase
            }
          if (prop === 'creator')
            return (c: string) => {
              requestedCreator = c
              return proxyBase
            }
          return () => proxyBase
        },
      },
    )
    const ctx = fakeContext({ indexer: { searchForApplications: () => proxyBase } })
    const result = await searchApplications(ctx, { limit: 500, creator: 'CREATORADDRESS' })
    expect(requestedLimit).toBe(100)
    expect(requestedCreator).toBe('CREATORADDRESS')
    expect(result.applications).toHaveLength(1)
    expect(result.applications[0]!.applicationId).toBe(123)
    expect(result.nextToken).toBeUndefined() // 1 < 100 → final page
  })

  test('keeps nextToken on a full page', async () => {
    const apps = Array.from({ length: 20 }, () => fakeIndexerApp)
    const ctx = fakeContext({
      indexer: {
        searchForApplications: () => chainable({ applications: apps, nextToken: 'tok' }),
      },
    })
    const result = await searchApplications(ctx, {})
    expect(result.applications).toHaveLength(20)
    expect(result.nextToken).toBe('tok')
  })
})

describe('lookupApplicationLogs', () => {
  test('returns log data and strips final page token', async () => {
    const logData = [{ txid: 'TX1', logs: [utf8('log entry')] }]
    const ctx = fakeContext({
      indexer: {
        lookupApplicationLogs: (id: number) => {
          expect(id).toBe(77)
          return chainable({ logData, nextToken: 'tok' })
        },
      },
    })
    const result = await lookupApplicationLogs(ctx, { applicationId: 77, txid: 'TX1' })
    expect(result.applicationId).toBe(77)
    expect(result.logData).toEqual(logData)
    expect(result.nextToken).toBeUndefined() // 1 < 20 → final page
  })

  test('defaults missing logData to empty array', async () => {
    const ctx = fakeContext({
      indexer: { lookupApplicationLogs: () => chainable({}) },
    })
    const result = await lookupApplicationLogs(ctx, { applicationId: 1 })
    expect(result.logData).toEqual([])
    expect(result.nextToken).toBeUndefined()
  })
})

describe('readGlobalState', () => {
  test('decodes bytes and uint state values', async () => {
    const ctx = fakeContext({
      algod: {
        getApplicationByID: () =>
          chainable({
            params: {
              globalState: [
                {
                  key: utf8('name'),
                  value: { type: 1, bytes: utf8('vibekit'), uint: BigInt(0) },
                },
                {
                  key: utf8('total'),
                  value: { type: 2, bytes: new Uint8Array(), uint: BigInt(9000) },
                },
              ],
            },
          }),
      },
    })
    const result = await readGlobalState(ctx, { appId: 5 })
    expect(result.appId).toBe(5)
    expect(result.state).toEqual([
      { key: 'name', value: 'vibekit', type: 'bytes' },
      { key: 'total', value: BigInt(9000), type: 'uint' },
    ])
  })

  test('maps keys to human-readable names via appSpec', async () => {
    const appSpec = JSON.stringify({
      state: { keys: { global: { counterName: { key: btoa('c') } } } },
    })
    const ctx = fakeContext({
      algod: {
        getApplicationByID: () =>
          chainable({
            params: {
              globalState: [
                { key: utf8('c'), value: { type: 2, bytes: new Uint8Array(), uint: BigInt(7) } },
              ],
            },
          }),
      },
    })
    const result = await readGlobalState(ctx, { appId: 5, appSpec })
    expect(result.state[0]!.key).toBe('counterName')
  })

  test('returns empty state when app has no global state', async () => {
    const ctx = fakeContext({
      algod: { getApplicationByID: () => chainable({ params: {} }) },
    })
    const result = await readGlobalState(ctx, { appId: 5 })
    expect(result.state).toEqual([])
  })
})

describe('readLocalState', () => {
  test('decodes local state key-values for an account', async () => {
    const ctx = fakeContext({
      algod: {
        accountApplicationInformation: (address: string, appId: number) => {
          expect(address).toBe('SOMEADDRESS')
          expect(appId).toBe(9)
          return chainable({
            appLocalState: {
              keyValue: [
                {
                  key: utf8('score'),
                  value: { type: 2, bytes: new Uint8Array(), uint: BigInt(3) },
                },
              ],
            },
          })
        },
      },
    })
    const result = await readLocalState(ctx, { appId: 9, address: 'SOMEADDRESS' })
    expect(result.appId).toBe(9)
    expect(result.address).toBe('SOMEADDRESS')
    expect(result.state).toEqual([{ key: 'score', value: BigInt(3), type: 'uint' }])
  })

  test('returns empty state when account is not opted in state', async () => {
    const ctx = fakeContext({
      algod: { accountApplicationInformation: () => chainable({}) },
    })
    const result = await readLocalState(ctx, { appId: 9, address: 'SOMEADDRESS' })
    expect(result.state).toEqual([])
  })
})

describe('readBoxState', () => {
  test('reads a simple box by UTF-8 name', async () => {
    let capturedName: Uint8Array | undefined
    const ctx = fakeContext({
      algod: {
        getApplicationBoxByName: (_appId: number, name: Uint8Array) => {
          capturedName = name
          return chainable({ value: utf8('boxvalue') })
        },
      },
    })
    const result = await readBoxState(ctx, { appId: 123, boxName: 'myBox' })
    expect(capturedName).toEqual(utf8('myBox'))
    expect(result).toEqual({
      appId: 123,
      boxName: 'myBox',
      exists: true,
      value: 'boxvalue',
      valueBase64: btoa('boxvalue'),
      size: 8,
    })
  })

  test('encodes BoxMap uint64 keys as prefix + 8-byte big-endian', async () => {
    let capturedName: Uint8Array | undefined
    const ctx = fakeContext({
      algod: {
        getApplicationBoxByName: (_appId: number, name: Uint8Array) => {
          capturedName = name
          return chainable({ value: new Uint8Array([1]) })
        },
      },
    })
    const result = await readBoxState(ctx, {
      appId: 123,
      keyPrefix: 'boxMap',
      key: 1,
      keyType: 'uint64',
    })
    expect(capturedName).toEqual(
      new Uint8Array([...utf8('boxMap'), 0, 0, 0, 0, 0, 0, 0, 1]),
    )
    expect(result.boxName).toBe('boxMap[1]')
    expect(result.exists).toBe(true)
  })

  test('defaults BoxMap keyType to uint64', async () => {
    let capturedName: Uint8Array | undefined
    const ctx = fakeContext({
      algod: {
        getApplicationBoxByName: (_appId: number, name: Uint8Array) => {
          capturedName = name
          return chainable({ value: new Uint8Array() })
        },
      },
    })
    await readBoxState(ctx, { appId: 1, keyPrefix: 'p', key: 2 })
    expect(capturedName).toEqual(new Uint8Array([...utf8('p'), 0, 0, 0, 0, 0, 0, 0, 2]))
  })

  test('returns exists: false when the box is not found', async () => {
    const ctx = fakeContext({
      algod: {
        getApplicationBoxByName: () => ({
          do: async () => {
            throw new Error('status 404: box not found')
          },
        }),
      },
    })
    const result = await readBoxState(ctx, { appId: 123, boxName: 'missing' })
    expect(result).toEqual({ appId: 123, boxName: 'missing', exists: false })
  })

  test('throws ToolError when neither boxName nor keyPrefix+key is given', async () => {
    const ctx = fakeContext({})
    expect(readBoxState(ctx, { appId: 123 })).rejects.toThrow(ToolError)
    expect(readBoxState(ctx, { appId: 123 })).rejects.toThrow(
      'Either boxName or keyPrefix+key must be provided',
    )
  })

  test('rethrows non-404 errors', async () => {
    const ctx = fakeContext({
      algod: {
        getApplicationBoxByName: () => ({
          do: async () => {
            throw new Error('network down')
          },
        }),
      },
    })
    expect(readBoxState(ctx, { appId: 1, boxName: 'b' })).rejects.toThrow('network down')
  })
})
