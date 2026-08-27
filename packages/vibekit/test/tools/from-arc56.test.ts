import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import algosdk, { ABIMethod, ABIType } from 'algosdk'
import { bytesToBase64 } from '../../src/core/index.js'

import {
  toolArgsFor,
  toolsWithMethods,
  decodeAppCall,
  enrichTransactionsWithAbi,
  normalizeAppSpec,
  toolsFromArc56,
} from '../../src/tools/contracts/index.js'
import { chainable, fakeContext } from './fake-context.js'

const ADDR_A = 'Y76M3MSY6DKBRHBL7C3NNDXGS5IIMQVQVUAB6MP4XEMMGVF2QWNPL226CA'

const suggestedParams = {
  flatFee: false,
  fee: BigInt(0),
  minFee: BigInt(1000),
  firstValid: BigInt(1),
  lastValid: BigInt(1000),
  genesisID: 'x',
  genesisHash: new Uint8Array(32),
}

const arc56 = readFileSync(join(import.meta.dir, 'fixtures', 'sample.arc56.json'), 'utf8')

describe('toolsFromArc56', () => {
  test('one tool per method: typed args, readonly simulates, writes require a signer', () => {
    const tools = toolsFromArc56(arc56, { appId: 1042 })
    expect(tools.map((t) => t.name)).toEqual(['counter_increment', 'counter_greet'])
    const increment = tools[0]!
    const greet = tools[1]!
    expect(increment.requiresSigner).toBe(true)
    expect(increment.view).toBe('txn')
    expect(greet.requiresSigner ?? false).toBe(false)
    expect(greet.view).toBe('json')

    const incrementShape = (increment.parameters as unknown as { shape: Record<string, unknown> })
      .shape
    expect(incrementShape.sender).toBeDefined()
    expect(incrementShape.amount).toBeDefined()
    expect(incrementShape.appId).toBeUndefined() // bound at generation
    const greetShape = (greet.parameters as unknown as { shape: Record<string, unknown> }).shape
    expect(greetShape.who).toBeDefined()
  })

  test('unbound appId is a required parameter', () => {
    const tools = toolsFromArc56(arc56)
    const shape = (tools[0]!.parameters as unknown as { shape: Record<string, unknown> }).shape
    expect(shape.appId).toBeDefined()
  })

  test('readonly greet simulates through ATC and returns the ABI value', async () => {
    const greet = toolsFromArc56(arc56, { appId: 1042 }).find((t) => t.name === 'counter_greet')!
    const simulateResponse = {
      lastRound: BigInt(9),
      txnGroups: [
        {
          txnResults: [{ txnResult: { logs: [] }, appBudgetConsumed: BigInt(12) }],
        },
      ],
    }
    const original = algosdk.AtomicTransactionComposer.prototype.simulate
    algosdk.AtomicTransactionComposer.prototype.simulate = async function () {
      return {
        simulateResponse,
        methodResults: [{ returnValue: 'hello, world' }],
      } as never
    }
    try {
      const ctx = fakeContext({
        algod: { getTransactionParams: () => chainable(suggestedParams) },
      })
      const result = (await greet.handler(ctx, { sender: ADDR_A, who: 'world' })) as {
        wouldSucceed: boolean
        returns: Array<{ value: unknown }>
      }
      expect(result.wouldSucceed).toBe(true)
      expect(result.returns[0]?.value).toBe('hello, world')
    } finally {
      algosdk.AtomicTransactionComposer.prototype.simulate = original
    }
  })

  test('write increment composes an unsigned app-call group', async () => {
    const increment = toolsFromArc56(arc56, { appId: 1042 }).find(
      (t) => t.name === 'counter_increment',
    )!
    const ctx = fakeContext({
      algod: { getTransactionParams: () => chainable(suggestedParams) },
    })
    const result = await increment.handler(ctx, { sender: ADDR_A, amount: 3 })
    if (!result || typeof result !== 'object' || !('unsignedGroup' in result)) {
      throw new Error('expected compose result')
    }
    expect((result as { unsignedGroup: string[] }).unsignedGroup).toHaveLength(1)
    expect((result as unknown as { summary: string }).summary).toMatch(/app/i)
    expect((result as unknown as { summary: string }).summary).toMatch(/^\w+\.\w+\(.*\) → app \d+$/)
  })

  test('rejects a missing required ABI argument', async () => {
    const increment = toolsFromArc56(arc56, { appId: 1042 })[0]!
    const ctx = fakeContext({
      algod: { getTransactionParams: () => chainable(suggestedParams) },
    })
    await expect(increment.handler(ctx, { sender: ADDR_A })).rejects.toThrow(/Missing argument/)
  })
})

describe('decodeAppCall', () => {
  test('selector + encoded uint64 arg + ABI return log', () => {
    const spec = normalizeAppSpec(arc56)
    const method = ABIMethod.fromSignature('increment(uint64)uint64')
    const applicationArgs = [
      bytesToBase64(method.getSelector()),
      bytesToBase64(ABIType.from('uint64').encode(BigInt(7))),
    ]
    const logs = [
      bytesToBase64(
        new Uint8Array([0x15, 0x1f, 0x7c, 0x75, ...ABIType.from('uint64').encode(BigInt(8))]),
      ),
    ]
    const decoded = decodeAppCall(spec, applicationArgs, logs)
    expect(decoded?.methodName).toBe('increment')
    expect(decoded?.args).toEqual([{ name: 'amount', type: 'uint64', value: 7 }])
    expect(decoded?.returnValue).toBe(8)
  })

  test('unknown selector yields undefined', () => {
    const spec = normalizeAppSpec(arc56)
    expect(decodeAppCall(spec, [bytesToBase64(new Uint8Array([1, 2, 3, 4]))])).toBeUndefined()
    expect(decodeAppCall(spec, [])).toBeUndefined()
  })

  test('enrichTransactionsWithAbi fills methodName on matching app calls', () => {
    const spec = normalizeAppSpec(arc56)
    const method = ABIMethod.fromSignature('greet(string)string')
    const txn = {
      applicationId: 1042,
      applicationArgs: [
        bytesToBase64(method.getSelector()),
        bytesToBase64(ABIType.from('string').encode('gabe')),
      ],
    }
    enrichTransactionsWithAbi([txn], new Map([[1042, spec]]))
    expect(txn).toMatchObject({ methodName: 'greet' })
    expect(txn).toHaveProperty('methodArgs')
  })
})

describe('spec-named args reach the generated handler', () => {
  const camelSpec = {
    name: 'Camel',
    methods: [
      {
        name: 'store',
        readonly: true,
        args: [
          { name: 'userName', type: 'string' },
          { name: 'sender', type: 'uint64' },
        ],
        returns: { type: 'void' },
      },
    ],
  }

  test('toolArgsFor maps ABI names onto the slugged tool parameters', () => {
    const [generated] = toolsWithMethods(JSON.stringify(camelSpec), { appId: 7 })
    if (!generated) throw new Error('expected a generated tool')
    const params = Object.keys(
      (generated.tool.parameters as unknown as unknown as { shape: Record<string, unknown> }).shape,
    )
    // userName slugs to lowercase; an arg literally named `sender` is prefixed
    // so it cannot collide with the tool's own sender parameter.
    expect(params).toContain('username')
    expect(params).not.toContain('userName')

    const mapped = toolArgsFor(generated.method, { userName: 'ada', sender: 5 })
    expect(mapped['username']).toBe('ada')
    expect(Object.keys(mapped)).not.toContain('userName')
    // Every mapped key is a real tool parameter — nothing is silently dropped.
    for (const key of Object.keys(mapped)) expect(params).toContain(key)
  })

  test('pairing is by method, so one signature inside another cannot mismatch', () => {
    const overlap = {
      name: 'Overlap',
      methods: [
        {
          name: 'add',
          readonly: true,
          args: [{ name: 'x', type: 'uint64' }],
          returns: { type: 'uint64' },
        },
        {
          name: 'readd',
          readonly: true,
          args: [{ name: 'x', type: 'uint64' }],
          returns: { type: 'uint64' },
        },
      ],
    }
    const generated = toolsWithMethods(JSON.stringify(overlap), { appId: 7 })
    const add = generated.find((entry) => entry.method.signature === 'add(uint64)uint64')
    expect(add?.method.name).toBe('add')
    expect(generated.filter((e) => e.tool.description.includes('add(uint64)uint64')).length).toBe(2)
  })
})

describe('fundAppMicroAlgos', () => {
  test('a funded write composes a two-txn group: payment to the app account, then the call', async () => {
    const { toolsWithMethods } = await import('../../src/tools/contracts/from-arc56.js')
    const { describeCall } = await import('../../src/tools/contracts/from-arc56.js')
    const spec = {
      name: 'Boxy',
      methods: [{ name: 'put', args: [{ name: 'v', type: 'string' }], returns: { type: 'void' } }],
      state: { schema: { global: { ints: 0, bytes: 0 }, local: { ints: 0, bytes: 0 } } },
    }
    const [{ tool, method }] = toolsWithMethods(JSON.stringify(spec), { appId: 7 })
    expect(
      tool.parameters.safeParse({ sender: 'x', v: 'a', fundAppMicroAlgos: 200000 }).success,
    ).toBe(true)
    expect(
      describeCall(
        {
          ...spec,
          format: 'arc56',
          methods: [method],
          schema: { globalInts: 0, globalBytes: 0, localInts: 0, localBytes: 0 },
          templateVariables: [],
        } as never,
        method,
        7,
        { v: 'a' },
        200000,
      ),
    ).toBe('Boxy.put(v: "a") → app 7 · funds app 200000 µALGO')
  })
})
