import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { ToolError } from '../../src/core/index.js'

import { getApplicationProgram } from '../../src/tools/contracts/program.js'
import { normalizeAppSpec } from '../../src/tools/contracts/app-spec.js'
import { analyzeTeal, labelSelectors } from '../../src/tools/contracts/teal.js'
import { chainable, fakeContext } from './fake-context.js'

/** Tinyman AMM v2 approval program (mainnet app 1002541853), disassembled by algod. */
const TINYMAN = readFileSync(
  new URL('./fixtures/tinyman-amm-approval.teal', import.meta.url),
  'utf8',
)
/** AlgoKit HelloWorld (PuyaPy 5.10): the ARC-56 byteCode, disassembled by algod. */
const HELLO = readFileSync(new URL('./fixtures/hello-world-approval.teal', import.meta.url), 'utf8')
const HELLO_SPEC = readFileSync(
  new URL('./fixtures/hello-world.arc56.json', import.meta.url),
  'utf8',
)

describe('analyzeTeal', () => {
  test('reads the facts out of a real disassembled program', () => {
    const facts = analyzeTeal(TINYMAN)
    expect(facts.version).toBe(7)
    expect(facts.stateKeys.global).toEqual(
      expect.arrayContaining(['fee_setter', 'fee_collector', 'fee_manager']),
    )
    expect(facts.strings).toContain('bootstrap')
    // Tinyman routes on strings, not ARC-4 selectors.
    expect(facts.entrypoints).toEqual(
      expect.arrayContaining(['bootstrap', 'swap', 'add_liquidity']),
    )
    expect(facts.selectors).toEqual([])
    expect(facts.arc4Returns).toBe(false)
    expect(facts.guards.rekey).toBe(true)
    expect(facts.innerTransactions).toBeGreaterThan(0)
    // The create/OnCompletion router: NoOp and OptIn handled, CloseOut/Update/Delete rejected.
    const byAction = Object.fromEntries(facts.onCompletion.map((e) => [e.action, e.outcome]))
    expect(byAction.NoOp).toBe('handled')
    expect(byAction.OptIn).toBe('handled')
    expect(byAction.UpdateApplication).toBe('rejected')
    expect(byAction.DeleteApplication).toBe('rejected')
  })

  test('reads a PuyaPy ARC-4 router: pushbytess + match, NoOp-only OnCompletion, spec names', () => {
    const facts = analyzeTeal(HELLO)
    expect(facts.version).toBe(11)
    expect(facts.entrypoints).toEqual(['0x02bece11', '0x72e3a928', '0x4f92e173'])
    expect(facts.onCompletion).toEqual([{ action: 'NoOp', outcome: 'handled' }])
    expect(facts.arc4Returns).toBe(true)
    expect(facts.stateKeys.box).toEqual(['msg'])
    const spec = normalizeAppSpec(HELLO_SPEC)
    const labelled = labelSelectors(facts.selectors, spec.methods)
    expect(labelled.map((m) => m.signature)).toEqual([
      'hello(string)string',
      'storeMessage(string,string)void',
      'getMessage(string)string',
    ])
  })

  test('finds ARC-4 selectors from pushbytes, bytecblock refs, and method pseudo-ops', () => {
    const teal = `#pragma version 10
bytecblock 0xdeadbeef 0x6b6579
txna ApplicationArgs 0
bytec_0
==
bnz label1
txna ApplicationArgs 0
method "hello(string)string"
==
bnz label2
err
label1:
bytec_1
pushint 1
app_global_put
pushint 1
return
label2:
pushint 1
return`
    const facts = analyzeTeal(teal)
    expect(facts.selectors).toContain('deadbeef')
    expect(facts.selectors).toHaveLength(2)
    expect(facts.entrypoints).toEqual(['0xdeadbeef', '0x02bece11'])
    expect(facts.stateKeys.global).toEqual(['key'])
    const labelled = labelSelectors(facts.selectors, [
      { name: 'hello', args: [{ type: 'string' }], returns: { type: 'string' } },
    ])
    expect(labelled.find((m) => m.name === 'hello')).toMatchObject({
      signature: 'hello(string)string',
      args: [{ type: 'string' }],
      returns: 'string',
    })
    expect(labelled.find((m) => m.selector === 'deadbeef')?.name).toBeUndefined()
  })
})

describe('getApplicationProgram', () => {
  const bytecode = new Uint8Array([7, 1, 2, 3])
  const algod = (disassemble: unknown) => ({
    getApplicationByID: () =>
      chainable({ params: { approvalProgram: bytecode, clearStateProgram: bytecode } }),
    disassemble: () => disassemble,
  })

  test('pages the TEAL and returns the analysis', async () => {
    const ctx = fakeContext({ algod: algod(chainable({ result: TINYMAN })) })
    const page = await getApplicationProgram(ctx, { applicationId: 1002541853 })
    expect(page.bytes).toBe(4)
    expect(page.programHash).toMatch(/^[0-9a-f]{64}$/)
    expect(page.fromLine).toBe(1)
    expect(page.toLine).toBe(600)
    expect(page.teal.split('\n')).toHaveLength(600)
    expect(page.totalLines).toBe(TINYMAN.split('\n').length)
    expect(page.analysis.version).toBe(7)
    const tail = await getApplicationProgram(ctx, {
      applicationId: 1,
      fromLine: page.totalLines - 1,
    })
    expect(tail.toLine).toBe(page.totalLines)
  })

  test('a node without the developer API is a clear error', async () => {
    const ctx = fakeContext({
      algod: algod({
        do: async () => {
          throw new Error('404')
        },
      }),
    })
    const failure = getApplicationProgram(ctx, { applicationId: 1 })
    await expect(failure).rejects.toBeInstanceOf(ToolError)
    await expect(failure).rejects.toMatchObject({ code: 'DISASSEMBLE_UNAVAILABLE' })
  })
})
