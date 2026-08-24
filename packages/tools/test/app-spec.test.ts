import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  detectAppSpecFormat,
  normalizeAppSpec,
  parseAppSpec,
  tryNormalizeAppSpec,
} from '../src/contracts/lib/app-spec.js'

const fixture = (name: string) => readFileSync(join(import.meta.dir, 'fixtures', name), 'utf8')

const arc56 = fixture('sample.arc56.json')
const arc32 = fixture('sample.arc32.json')
const arc4 = fixture('sample.arc4.json')

describe('detectAppSpecFormat', () => {
  test('tells the three formats apart structurally', () => {
    expect(detectAppSpecFormat(JSON.parse(arc56))).toBe('arc56')
    expect(detectAppSpecFormat(JSON.parse(arc32))).toBe('arc32')
    expect(detectAppSpecFormat(JSON.parse(arc4))).toBe('arc4')
  })

  test('rejects non-spec JSON values', () => {
    expect(detectAppSpecFormat({ hello: 'world' })).toBeUndefined()
    expect(detectAppSpecFormat({ name: 'x', methods: 'nope' })).toBeUndefined()
    expect(detectAppSpecFormat([1, 2, 3])).toBeUndefined()
    expect(detectAppSpecFormat('string')).toBeUndefined()
    expect(detectAppSpecFormat(null)).toBeUndefined()
  })
})

describe('normalizeAppSpec', () => {
  test('ARC-56 passes through: schema, methods, source, declared template vars', () => {
    const spec = normalizeAppSpec(arc56)
    expect(spec.format).toBe('arc56')
    expect(spec.name).toBe('Counter')
    expect(spec.schema).toEqual({ globalInts: 1, globalBytes: 1, localInts: 0, localBytes: 0 })
    expect(spec.methods.map((m) => m.signature)).toEqual([
      'increment(uint64)uint64',
      'greet(string)string',
    ])
    expect(spec.methods[0]?.readonly).toBeUndefined()
    expect(spec.methods[1]?.readonly).toBe(true)
    expect(spec.methods[0]?.args[0]).toEqual({
      name: 'amount',
      type: 'uint64',
      description: 'How much to add',
    })
    expect(spec.source?.approval).toBeString()
    expect(spec.templateVariables).toEqual(['LIMIT'])
  })

  test('ARC-56 keeps named state keys and bare actions; other formats have neither', () => {
    const spec = normalizeAppSpec(
      JSON.stringify({
        ...JSON.parse(arc56),
        state: {
          schema: { global: { ints: 1, bytes: 0 } },
          keys: {
            global: { count: { keyType: 'AVMString', valueType: 'uint64', key: 'Y291bnQ=', desc: 'hits' } },
            local: {},
            box: { greeting: { keyType: 'AVMString', valueType: 'AVMString', key: 'Z3JlZXRpbmc=' } },
          },
        },
        bareActions: { create: ['NoOp'], call: [] },
      }),
    )
    expect(spec.stateKeys).toEqual({
      global: { count: { keyType: 'AVMString', valueType: 'uint64', key: 'Y291bnQ=', description: 'hits' } },
      local: {},
      box: { greeting: { keyType: 'AVMString', valueType: 'AVMString', key: 'Z3JlZXRpbmc=' } },
    })
    expect(spec.bareActions).toEqual({ create: ['NoOp'], call: [] })
    expect(normalizeAppSpec(arc56).stateKeys).toEqual({ global: {}, local: {}, box: {} })
    expect(normalizeAppSpec(arc32).stateKeys).toBeUndefined()
    expect(normalizeAppSpec(arc4).bareActions).toBeUndefined()
  })

  test('ARC-32 converts: contract wrapper, num_uints schema, TMPL scan, txn arg types', () => {
    const spec = normalizeAppSpec(arc32)
    expect(spec.format).toBe('arc32')
    expect(spec.name).toBe('Vault')
    expect(spec.schema).toEqual({ globalInts: 3, globalBytes: 2, localInts: 1, localBytes: 0 })
    expect(spec.methods[0]?.signature).toBe('deposit(pay,uint64)void')
    expect(spec.methods[0]?.description).toBe('Deposit into the vault.')
    expect(spec.templateVariables).toEqual(['FEE'])
  })

  test('bare ARC-4 converts methods-only with a zero schema', () => {
    const spec = normalizeAppSpec(arc4)
    expect(spec.format).toBe('arc4')
    expect(spec.name).toBe('Greeter')
    expect(spec.schema).toEqual({ globalInts: 0, globalBytes: 0, localInts: 0, localBytes: 0 })
    expect(spec.methods.map((m) => m.signature)).toEqual(['hello(string)string', 'ping()void'])
    expect(spec.source).toBeUndefined()
  })

  test('rejects invalid JSON, non-spec JSON, and bad ABI types', () => {
    expect(() => normalizeAppSpec('not json')).toThrow('not valid JSON')
    expect(() => normalizeAppSpec('{"kind":"wallet"}')).toThrow('not an ARC-56, ARC-32, or ARC-4')
    const badType = JSON.stringify({
      name: 'Bad',
      methods: [{ name: 'go', args: [{ type: 'uint9000' }], returns: { type: 'void' } }],
    })
    expect(() => normalizeAppSpec(badType)).toThrow('not valid ARC-4')
  })
})

describe('tryNormalizeAppSpec', () => {
  test('returns undefined instead of throwing on non-spec input', () => {
    expect(tryNormalizeAppSpec('not json')).toBeUndefined()
    expect(tryNormalizeAppSpec('{"a":1}')).toBeUndefined()
    expect(tryNormalizeAppSpec(arc56)?.name).toBe('Counter')
  })
})

describe('parseAppSpec over the normalizer', () => {
  test('decodes TEAL for every accepted format', () => {
    expect(parseAppSpec(arc56).approvalTeal).toContain('TMPL_LIMIT')
    expect(parseAppSpec(arc32).approvalTeal).toContain('TMPL_FEE')
    expect(parseAppSpec(arc4).approvalTeal).toBeUndefined()
    expect(parseAppSpec(arc4).methods).toHaveLength(2)
  })
})
