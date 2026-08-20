import { describe, expect, test } from 'bun:test'
import algosdk from 'algosdk'
import { base64ToBytes, bytesToBase64 } from '@initlabs/vibekit-core'
import { parseAppSpec, substituteTemplateParams } from '../src/contracts/lib/app-spec.js'
import { contractWriteTools } from '../src/contracts/tools-write.js'
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

const teal = (src: string) => bytesToBase64(new TextEncoder().encode(src))

const arc56Spec = JSON.stringify({
  name: 'Spike',
  methods: [
    { name: 'hello', args: [{ name: 'who', type: 'string' }], returns: { type: 'string' } },
  ],
  state: { schema: { global: { ints: 1, bytes: 2 }, local: { ints: 0, bytes: 0 } } },
  source: { approval: teal('#pragma version 10\nint TMPL_ANSWER\n'), clear: teal('#pragma version 10\nint 1\n') },
})

const arc32Spec = JSON.stringify({
  contract: { name: 'Old', methods: [{ name: 'go', args: [], returns: { type: 'void' } }] },
  source: { approval: teal('int 1'), clear: teal('int 1') },
  state: { global: { num_uints: 3, num_byte_slices: 4 }, local: { num_uints: 5, num_byte_slices: 6 } },
})

describe('parseAppSpec', () => {
  test('parses ARC-56: schema, methods, TEAL source', () => {
    const spec = parseAppSpec(arc56Spec)
    expect(spec.name).toBe('Spike')
    expect(spec.schema).toEqual({ globalInts: 1, globalBytes: 2, localInts: 0, localBytes: 0 })
    expect(spec.methods[0]?.signature).toBe('hello(string)string')
    expect(spec.approvalTeal).toContain('TMPL_ANSWER')
  })

  test('parses ARC-32: contract wrapper and num_uints schema', () => {
    const spec = parseAppSpec(arc32Spec)
    expect(spec.name).toBe('Old')
    expect(spec.schema).toEqual({ globalInts: 3, globalBytes: 4, localInts: 5, localBytes: 6 })
    expect(spec.methods[0]?.signature).toBe('go()void')
  })

  test('substitutes TMPL_ params', () => {
    expect(substituteTemplateParams('int TMPL_ANSWER', { ANSWER: 42 })).toBe('int 42')
    expect(substituteTemplateParams('int TMPL_ANSWER', { TMPL_ANSWER: 7 })).toBe('int 7')
  })
})

describe('contract write tools', () => {
  test('registry: writes require signer; reads do not', () => {
    const names = contractWriteTools.map((t) => t.name)
    expect(names).toEqual([
      'app_deploy',
      'app_call',
      'app_opt_in',
      'app_close_out',
      'app_delete',
    ])
    for (const tool of contractWriteTools) {
      expect(tool.requiresSigner).toBe(true)
    }
  })

  test('app_deploy composes a create txn: compiles TEAL with template subs, sets schema', async () => {
    const compiled: string[] = []
    const ctx = fakeContext({
      algod: {
        getTransactionParams: () => chainable(suggestedParams),
        compile: (src: Uint8Array) => {
          compiled.push(new TextDecoder().decode(src))
          // "compiled" bytecode: 4 arbitrary bytes, base64 in algod's response shape
          return chainable({ result: bytesToBase64(new Uint8Array([1, 2, 3, 4])) })
        },
      },
    })
    const tool = contractWriteTools.find((t) => t.name === 'app_deploy')!
    const result = (await tool.handler(ctx, {
      sender: ADDR_A,
      appSpec: arc56Spec,
      deployTimeParams: { ANSWER: 42 },
    } as never)) as { unsignedGroup: string[]; summary: string }

    expect(compiled[0]).toContain('int 42') // template substituted before compile
    const txn = algosdk.decodeUnsignedTransaction(base64ToBytes(result.unsignedGroup[0]!))
    expect(txn.applicationCall?.appIndex).toBe(BigInt(0))
    expect(Number(txn.applicationCall?.numGlobalInts)).toBe(1)
    expect(Number(txn.applicationCall?.numGlobalByteSlices)).toBe(2)
    expect(result.summary).toContain('Spike')
  })

  test('app_call composes an ABI method call', async () => {
    const ctx = fakeContext({ algod: { getTransactionParams: () => chainable(suggestedParams) } })
    const tool = contractWriteTools.find((t) => t.name === 'app_call')!
    const result = (await tool.handler(ctx, {
      sender: ADDR_A,
      appId: 7,
      appSpec: arc56Spec,
      method: 'hello',
      args: ['world'],
    } as never)) as { unsignedGroup: string[] }
    const txn = algosdk.decodeUnsignedTransaction(base64ToBytes(result.unsignedGroup[0]!))
    expect(txn.applicationCall?.appIndex).toBe(BigInt(7))
    expect(txn.applicationCall?.appArgs?.length).toBeGreaterThan(0) // selector + encoded arg
  })
})
