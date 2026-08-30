import { describe, expect, test } from 'bun:test'
import { ToolError } from '../../src/core/index.js'
import { contractQueries } from '../../src/tools/contracts/index.js'
import { lookupApplication, lookupApplicationLogs } from '../../src/tools/contracts/lookup.js'
import { searchApplications } from '../../src/tools/contracts/search.js'
import { decodeAddress } from 'algosdk'

import { bytesToBase64 } from '../../src/core/index.js'

import {
  listApplicationBoxes,
  readBoxState,
  readGlobalState,
  readLocalState,
} from '../../src/tools/contracts/state.js'
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
  test('exports 10 read-only tools with output schemas and view or display hints', () => {
    expect(contractQueries.map((t) => t.name)).toEqual([
      'lookup_application',
      'search_applications',
      'lookup_application_logs',
      'read_global_state',
      'read_local_state',
      'read_box_state',
      'list_application_boxes',
      'get_application_info',
      'get_application_program',
      'list_app_spec_methods',
    ])
    for (const tool of contractQueries) {
      expect(tool.requiresSigner ?? false).toBe(false)
      expect(tool.output).toBeDefined()
      expect(tool.view).toBeDefined()
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
      // uint entries carry no bytes (empty Uint8Array is omitted), and the
      // uint stays a bigint so jsonSafe can emit number-or-decimal-string.
      value: { type: 2, uint: BigInt(42) },
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
      {
        key: 'name',
        keyBase64: btoa('name'),
        value: 'vibekit',
        valueBase64: btoa('vibekit'),
        type: 'bytes',
      },
      { key: 'total', keyBase64: btoa('total'), value: BigInt(9000), type: 'uint' },
    ])
  })

  test('decodes a 32-byte bytes value as an address, binary as base64', async () => {
    const addressBytes = decodeAddress(
      'YFN66NKXPMN5YM36H7ZOOBEGZBY7FFNOJ2JKJI6MNUYDXGKJPOQQPZ6Q3E',
    ).publicKey
    const binary = new Uint8Array([0xff, 0x00, 0x1b, 0x80])
    const ctx = fakeContext({
      algod: {
        getApplicationByID: () =>
          chainable({
            params: {
              globalState: [
                { key: utf8('ca'), value: { type: 1, bytes: addressBytes, uint: BigInt(0) } },
                { key: utf8('blob'), value: { type: 1, bytes: binary, uint: BigInt(0) } },
              ],
            },
          }),
      },
    })
    const result = await readGlobalState(ctx, { appId: 5 })
    // Address decode, not a control-char utf-8 string.
    expect(result.state[0]!.value).toBe(
      'YFN66NKXPMN5YM36H7ZOOBEGZBY7FFNOJ2JKJI6MNUYDXGKJPOQQPZ6Q3E',
    )
    // Non-printable binary falls back to base64 (never a mangled string).
    expect(result.state[1]!.value).toBe(bytesToBase64(binary))
    // Raw base64 is always preserved alongside.
    expect(result.state[0]!.valueBase64).toBe(bytesToBase64(addressBytes))
  })

  test('maps keys to human-readable names via appSpec', async () => {
    // The smallest ARC-56 file with a named global key; a bare state object is not a spec.
    const appSpec = JSON.stringify({
      name: 'Counter',
      methods: [],
      state: {
        keys: {
          global: { counterName: { keyType: 'AVMString', valueType: 'AVMUint64', key: btoa('c') } },
        },
      },
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
    expect(result.optedIn).toBe(true)
    expect(result.state).toEqual([
      { key: 'score', keyBase64: btoa('score'), value: BigInt(3), type: 'uint' },
    ])
  })

  test('returns empty state when account is not opted in state', async () => {
    const ctx = fakeContext({
      algod: { accountApplicationInformation: () => chainable({}) },
    })
    const result = await readLocalState(ctx, { appId: 9, address: 'SOMEADDRESS' })
    expect(result.optedIn).toBe(false)
    expect(result.state).toEqual([])
  })

  test('never-opted-in account (algod 404) is optedIn:false, not an error', async () => {
    // Live finding: algod 404s accountApplicationInformation for an account
    // that never opted in; only closed-out accounts return info without state.
    const ctx = fakeContext({
      algod: {
        accountApplicationInformation: () =>
          chainable(
            Promise.reject(
              new Error(
                'Network request error. Received status 404 (Not Found): account application info not found',
              ),
            ),
          ),
      },
    })
    const result = await readLocalState(ctx, { appId: 9, address: 'SOMEADDRESS' })
    expect(result).toEqual({
      appId: 9,
      scope: 'local',
      address: 'SOMEADDRESS',
      optedIn: false,
      state: [],
    })
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
    expect(capturedName).toEqual(new Uint8Array([...utf8('boxMap'), 0, 0, 0, 0, 0, 0, 0, 1]))
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

describe('list_app_spec_methods', () => {
  test('returns parsed methods without touching the chain', async () => {
    const spec = JSON.stringify({
      contract: { name: 'Old', methods: [{ name: 'go', args: [], returns: { type: 'void' } }] },
    })
    const tool = contractQueries.find((t) => t.name === 'list_app_spec_methods')!
    const result = (await tool.handler(fakeContext({}), { appSpec: spec } as never)) as {
      methods: Array<{ signature: string }>
    }
    expect(result.methods[0]?.signature).toBe('go()void')
  })
})

describe('listApplicationBoxes', () => {
  test('lists box names from algod, decoding printable and binary names', async () => {
    const ctx = fakeContext({
      algod: {
        getApplicationBoxes: () =>
          chainable({
            boxes: [{ name: utf8('config') }, { name: new Uint8Array([0x00, 0xff, 0x10]) }],
          }),
      },
    })
    const result = await listApplicationBoxes(ctx, { appId: 42 })
    expect(result.appId).toBe(42)
    expect(result.boxes).toEqual([
      { name: 'config', nameBase64: btoa('config') },
      {
        name: bytesToBase64(new Uint8Array([0x00, 0xff, 0x10])),
        nameBase64: bytesToBase64(new Uint8Array([0x00, 0xff, 0x10])),
      },
    ])
    expect(result.truncated).toBeUndefined()
  })

  test('flags truncation when a full page of `limit` boxes comes back', async () => {
    const boxes = Array.from({ length: 2 }, (_, i) => ({ name: utf8(`b${i}`) }))
    const ctx = fakeContext({ algod: { getApplicationBoxes: () => chainable({ boxes }) } })
    const result = await listApplicationBoxes(ctx, { appId: 42, limit: 2 })
    expect(result.boxes).toHaveLength(2)
    expect(result.truncated).toBe(true)
  })
})
