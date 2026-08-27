import { describe, expect, test } from 'bun:test'
import type { ParsedMethod } from '@initlabs/vibekit/tools'

import { methodPrompt, parseMethodArgs, splitTokens } from '../src/features/apps/method-args.js'

const ADDR = 'P5CVZ5SJRYHOSSARSX2XMSD5HWJK7Z5WEMQCAHHQ47DOK4BMWWVPQN6DVU'
const method: ParsedMethod = {
  name: 'swap',
  signature: 'swap(string,uint64,account,asset,bool,pay,uint64[])void',
  args: [
    { name: 'note', type: 'string' },
    { name: 'amount', type: 'uint64' },
    { name: 'who', type: 'account' },
    { name: 'asa', type: 'asset' },
    { name: 'fast', type: 'bool' },
    { name: 'deposit', type: 'pay' },
    { type: 'uint64[]' },
  ],
  returns: { type: 'void' },
}

describe('method line', () => {
  test('tokens split on space/comma but keep quotes and brackets whole', () => {
    expect(splitTokens(`"hi there" 1, [1,2] {"a":"b c"} x=y`)).toEqual([
      '"hi there"',
      '1',
      '[1,2]',
      '{"a":"b c"}',
      'x=y',
    ])
  })

  test('positional, name=value, and JSON forms all land on ABI names with coerced values', () => {
    const line = `"hi" 5 ${ADDR} 31566704 true {"type":"pay","receiver":"${ADDR}","amount":1000} [1,2]`
    const positional = parseMethodArgs(method, line)
    expect(positional).toEqual({
      ok: true,
      named: {
        note: 'hi',
        amount: 5,
        who: ADDR,
        asa: 31566704,
        fast: true,
        deposit: { type: 'pay', receiver: ADDR, amount: 1000 },
        arg6: [1, 2],
      },
    })
    const pairs = parseMethodArgs(
      method,
      `arg6=[1] deposit={"type":"pay"} fast=false asa=1 who=${ADDR} amount=0 note=x`,
    )
    expect(pairs.ok && pairs.named.fast).toBe(false)
    expect(parseMethodArgs(method, '{"note":"j"}')).toEqual({ ok: true, named: { note: 'j' } })
  })

  test('type errors name the arg; missing and extra args are caught', () => {
    const hello: ParsedMethod = {
      name: 'hello',
      signature: 'hello(string)string',
      args: [{ name: 'name', type: 'string' }],
      returns: { type: 'string' },
    }
    expect(parseMethodArgs(hello, '')).toMatchObject({
      ok: false,
      error: 'hello needs 1 arg: name',
    })
    expect(parseMethodArgs(hello, 'a b')).toMatchObject({
      ok: false,
      error: expect.stringContaining('too many'),
    })
    expect(parseMethodArgs(method, 'x notanumber')).toMatchObject({
      ok: false,
      error: expect.stringContaining('amount — uint64'),
    })
    expect(parseMethodArgs(method, `x 1 ${ADDR}`)).toMatchObject({
      ok: false,
      error: expect.stringContaining('missing: asa'),
    })
    expect(parseMethodArgs(hello, 'nope=1')).toMatchObject({
      ok: false,
      error: 'no arg named nope',
    })
    expect(parseMethodArgs({ ...hello, args: [] }, '')).toEqual({ ok: true, named: {} })
  })

  test('prompt shows names and types', () => {
    expect(methodPrompt(method)).toBe(
      'swap(note: string, amount: uint64, who: account, asa: asset, fast: bool, deposit: pay, arg6: uint64[])',
    )
  })
})

describe('line modifiers', () => {
  test('+fund and +fee come off the line as microALGO; bad amounts are errors', () => {
    const hello: ParsedMethod = {
      name: 'hello',
      signature: 'hello(string)string',
      args: [{ name: 'name', type: 'string' }],
      returns: { type: 'string' },
    }
    expect(parseMethodArgs(hello, '"hi" +fund 0.2 +fee 0.002')).toEqual({
      ok: true,
      named: { name: 'hi' },
      fundMicroAlgos: 200000,
      extraFeeMicroAlgos: 2000,
    })
    expect(parseMethodArgs(hello, '+fund 0.11 name=x')).toEqual({
      ok: true,
      named: { name: 'x' },
      fundMicroAlgos: 110000,
    })
    expect(parseMethodArgs(hello, '"hi" +fund')).toMatchObject({
      ok: false,
      error: expect.stringContaining('+fund needs'),
    })
    expect(parseMethodArgs(hello, '"hi" +fund -1')).toMatchObject({ ok: false })
  })
})
