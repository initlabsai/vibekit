import { describe, expect, test } from 'bun:test'
import algosdk from 'algosdk'
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test'
import { z } from 'zod'

import { bytesToBase64, defineAction, defineQuery } from '../../src/core/index.js'
import { createAgentHandler, type AgentSession } from '../../src/agent/index.js'

const USAGE = {
  inputTokens: { total: 10, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: undefined, reasoning: undefined },
} as never
const textModel = (text: string) =>
  new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start' as const, warnings: [] },
          { type: 'text-start' as const, id: 't1' },
          { type: 'text-delta' as const, id: 't1', delta: text },
          { type: 'text-end' as const, id: 't1' },
          { type: 'finish' as const, finishReason: { unified: 'stop' as const, raw: 'stop' }, usage: USAGE },
        ],
      }),
    }),
  })

const SENDER = algosdk.generateAccount()
const params: algosdk.SuggestedParams = { fee: 1000, firstValid: 1, lastValid: 1001, genesisID: 'test', genesisHash: new Uint8Array(32), minFee: 1000 }
const unsigned = bytesToBase64(
  algosdk.encodeUnsignedTransaction(
    algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: SENDER.addr, receiver: SENDER.addr, amount: 250_000, suggestedParams: params }),
  ),
)
const echo = defineQuery({ name: 'echo', description: 'says it back', parameters: z.object({ text: z.string() }), output: z.unknown(), handler: async (_c, a) => a })
const pay = defineAction({ name: 'send_payment', description: 'drafts', parameters: z.object({ sender: z.string() }), output: z.unknown(), handler: async () => ({ unsignedGroup: [unsigned], summary: 'pay 0.25 ALGO' }) })

/** A scripted session in place of the model loop: narrates, composes a payment, reads, done. */
function scripted(options: { history?: readonly unknown[] }): AgentSession {
  const messages: unknown[] = [...(options.history ?? [])]
  return {
    async *stream(input: string) {
      messages.push({ role: 'user', content: input })
      yield { type: 'text-delta', text: 'On it. ' }
      yield { type: 'tool-result', id: 'call-1', toolName: 'send_payment', input: { sender: 'x', network: 'testnet' }, output: { unsignedGroup: [unsigned], summary: 'pay 0.25 ALGO' }, isError: false }
      yield { type: 'tool-result', id: 'call-2', toolName: 'echo', input: { text: 'hi' }, output: { text: 'hi' }, isError: false }
      yield { type: 'finish', finishReason: 'stop' }
      messages.push({ role: 'assistant', content: 'On it. ' })
    },
    get messages() {
      return messages as never
    },
    reset() {},
  }
}

async function events(response: Response) {
  return (await response.text()).split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>)
}
const post = (handler: { fetch(r: Request): Promise<Response> }, body: unknown, headers: Record<string, string> = {}) =>
  handler.fetch(new Request('http://x/api/agent', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }))

describe('createAgentHandler', () => {
  test('streams the model over the tools as NDJSON, with the turn context prepended', async () => {
    const seen: string[] = []
    const handler = createAgentHandler({
      network: 'localnet',
      mode: 'compose',
      tools: [echo],
      model: textModel('hello'),
      systemPrompt: (turn) => `net=${turn.network} tools=${turn.tools.map((t) => t.name).join(',')} accounts=${turn.accounts.length}`,
      createSession: (options) => {
        seen.push(options.systemPrompt!)
        const session = scripted(options)
        return { ...session, stream: (input: string) => { seen.push(input); return session.stream(input) } } as AgentSession
      },
    })
    const response = await post(handler, { input: 'hi', accounts: [{ address: SENDER.addr.toString(), name: 'me' }], activeAddress: SENDER.addr.toString(), context: 'Cards on screen:\n- x' })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('x-ndjson')
    expect(seen[0]).toBe('net=localnet tools=echo accounts=1')
    expect(seen[1]).toMatch(/^Active account \(default sender\): me \(/)
    expect(seen[1]).toContain('Cards on screen:\n- x\n\nhi')
    expect(handler.describe()).toEqual({ networks: ['localnet'], tools: ['echo'] })
  })

  test('a composed group leaves as a draft record on the network the call named; history comes back sliced', async () => {
    const handler = createAgentHandler({ network: 'localnet', networks: ['localnet', 'testnet'], mode: 'compose', tools: [echo, pay], model: textModel(''), createSession: scripted })
    const stream = await events(await post(handler, { network: 'localnet', input: 'pay', history: [{ role: 'user', content: 'earlier' }] }))
    expect(stream.map((event) => event.type)).toEqual(['text-delta', 'draft', 'tool-result', 'finish', 'messages'])
    const draft = stream[1]!.record as { toolName: string; network: string; state: string; data: { unsignedGroup: { transactions: string[] }; sender: string } }
    expect(draft).toMatchObject({ toolName: 'send_payment', network: 'testnet', state: 'success' })
    expect(draft.data.unsignedGroup.transactions).toEqual([unsigned])
    expect(draft.data.sender).toBe(SENDER.addr.toString())
    expect((stream[4]!.messages as unknown[]).length).toBe(2)
  })

  test('per-turn caps gate only the tools they name; billing runs first and its refusal is the response', async () => {
    let approve!: NonNullable<Parameters<typeof scripted>[0] & { approveToolCall?: (c: { toolName: string; input: unknown }) => Promise<boolean> }>['approveToolCall']
    const handler = createAgentHandler({
      network: 'localnet', mode: 'compose', tools: [echo, pay], model: textModel(''),
      perTurn: { echo: 2 },
      billing: { charge: async (request) => (request.headers.get('x-pay') ? { ok: true, credits: { paid: 4 } } : { ok: false, response: Response.json({ error: 'pay up' }, { status: 402 }) }) },
      createSession: (options) => { approve = options.approveToolCall; return scripted(options) },
    })
    expect((await post(handler, { input: 'hi' })).status).toBe(402)
    const stream = await events(await post(handler, { input: 'hi' }, { 'x-pay': '1' }))
    expect(stream[0]).toEqual({ type: 'credits', credits: { paid: 4 } })
    expect(await approve!({ toolName: 'send_payment', input: {} })).toBe(true)
    expect(await approve!({ toolName: 'echo', input: {} })).toBe(true)
    expect(await approve!({ toolName: 'echo', input: {} })).toBe(true)
    expect(await approve!({ toolName: 'echo', input: {} })).toBe(false)
  })

  test('refuses what it cannot serve: bad JSON, a bad body, an unserved network, a non-POST', async () => {
    const handler = createAgentHandler({ network: 'localnet', mode: 'compose', tools: [echo], model: textModel(''), createSession: scripted, limits: { bodyBytes: 64 } })
    expect((await post(handler, '{nope')).status).toBe(400)
    expect((await post(handler, { input: '' })).status).toBe(400)
    expect((await post(handler, { input: 'hi', network: 'mainnet' })).status).toBe(400)
    expect((await post(handler, { input: 'x'.repeat(100) })).status).toBe(413)
    expect((await handler.fetch(new Request('http://x/api/agent'))).status).toBe(405)
  })
})
