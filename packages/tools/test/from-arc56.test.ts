import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import algosdk, { ABIMethod, ABIType } from 'algosdk'
import { bytesToBase64 } from '@initlabs/vibekit-core'

import {
  decodeAppCall,
  enrichTransactionsWithAbi,
  normalizeAppSpec,
  toolsFromArc56,
} from '../src/contracts/index.js'
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

    const incrementShape = (increment.parameters as { shape: Record<string, unknown> }).shape
    expect(incrementShape.sender).toBeDefined()
    expect(incrementShape.amount).toBeDefined()
    expect(incrementShape.appId).toBeUndefined() // bound at generation
    const greetShape = (greet.parameters as { shape: Record<string, unknown> }).shape
    expect(greetShape.who).toBeDefined()
  })

  test('unbound appId is a required parameter', () => {
    const tools = toolsFromArc56(arc56)
    const shape = (tools[0]!.parameters as { shape: Record<string, unknown> }).shape
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
    const increment = toolsFromArc56(arc56, { appId: 1042 }).find((t) => t.name === 'counter_increment')!
    const ctx = fakeContext({
      algod: { getTransactionParams: () => chainable(suggestedParams) },
    })
    const result = await increment.handler(ctx, { sender: ADDR_A, amount: 3 })
    if (!result || typeof result !== 'object' || !('unsignedGroup' in result)) {
      throw new Error('expected compose result')
    }
    expect((result as { unsignedGroup: string[] }).unsignedGroup).toHaveLength(1)
    expect((result as { summary: string }).summary).toMatch(/app/i)
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
      bytesToBase64(new Uint8Array([0x15, 0x1f, 0x7c, 0x75, ...ABIType.from('uint64').encode(BigInt(8))])),
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
