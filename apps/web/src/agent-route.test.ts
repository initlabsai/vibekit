import { afterEach, describe, expect, mock, test } from 'bun:test'

import {
  createFixtureResultStore,
  FIXTURE_SENDER,
  PAYMENT_FIXTURE_UNSIGNED_TRANSACTION,
} from '@initlabs/vibekit-explorer'

const live = await import('@initlabs/vibekit-explorer/live')

/** The agent is a scripted session: a sentence, one composed payment, one read, done. */
const created: unknown[] = []
mock.module('@initlabs/vibekit-explorer/live', () => ({
  ...live,
  createExplorerAgent: (options: unknown) => {
    created.push(options)
    const messages: unknown[] = [...((options as { history?: unknown[] }).history ?? [])]
    return {
      async *stream(input: string) {
        messages.push({ role: 'user', content: input })
        yield { type: 'text-delta', text: 'On it. ' }
        yield {
          type: 'tool-result',
          id: 'call-1',
          toolName: 'send_payment',
          input: { sender: FIXTURE_SENDER, network: 'localnet' },
          output: { unsignedGroup: [PAYMENT_FIXTURE_UNSIGNED_TRANSACTION], summary: 'pay 0.25 ALGO' },
          view: 'transaction.detail',
          isError: false,
        }
        yield {
          type: 'tool-result',
          id: 'call-2',
          toolName: 'get_account_portfolio',
          input: { address: FIXTURE_SENDER },
          output: (createFixtureResultStore().find((r) => r.toolName === 'get_account_portfolio') as { data: unknown } | undefined)?.data ?? {},
          view: 'account.portfolio',
          isError: false,
        }
        yield { type: 'finish', finishReason: 'stop' }
        messages.push({ role: 'assistant', content: 'On it. ' })
      },
      get messages() {
        return messages
      },
      reset() {},
    }
  },
}))

const { GET, POST } = await import('../app/api/agent/route.js')

const env = { ...process.env }
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]
  Object.assign(process.env, env)
  created.length = 0
})

async function events(response: Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text()
  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>)
}

describe('agent route', () => {
  test('without a Together key the lane is off: GET says so, POST is 404', async () => {
    delete process.env.TOGETHER_API_KEY
    expect(await (await GET()).json()).toEqual({ enabled: false, private: false })
    const response = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ network: 'localnet', input: 'hi' }) }))
    expect(response.status).toBe(404)
  })

  test('a turn streams narration, drafts a composed group, bridges a read, and returns the new history', async () => {
    process.env.TOGETHER_API_KEY = 'test-key'
    process.env.TOGETHER_MODEL = 'test/model'
    expect(await (await GET()).json()).toEqual({ enabled: true, model: 'test/model', provider: 'together', billing: 'house', private: false })
    const response = await POST(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({
          network: 'localnet',
          input: 'pay alice 0.25',
          accounts: [{ address: FIXTURE_SENDER, name: 'me' }],
          activeAddress: FIXTURE_SENDER,
          context: 'Cards on screen (oldest first):\n- lookup_block: round=1',
          history: [{ role: 'user', content: 'earlier' }],
        }),
      }),
    )
    expect(response.status).toBe(200)
    const stream = await events(response)
    expect(stream.map((event) => event.type)).toEqual(['text-delta', 'draft', 'tool-result', 'finish', 'messages'])
    const draft = stream[1]!.record as { toolName: string; state: string; data: { unsignedGroup: { transactions: string[] } } }
    expect(draft.toolName).toBe('send_payment')
    expect(draft.state).toBe('success')
    expect(draft.data.unsignedGroup.transactions).toEqual([PAYMENT_FIXTURE_UNSIGNED_TRANSACTION])
    // Only the turn's new messages come back; the browser already holds the earlier ones.
    expect((stream[4]!.messages as unknown[]).length).toBe(2)
    const options = created[0] as { history: unknown[]; addressBook: unknown[]; network: string; model: { provider: string; baseUrl: string } }
    expect(options.history).toHaveLength(1)
    expect(options.network).toBe('localnet')
    expect(options.model).toMatchObject({ provider: 'openai-compatible', baseUrl: 'https://api.together.xyz/v1' })
    // The public host never approves an expensive read.
    const approve = (created[0] as { approveToolCall: (call: unknown) => Promise<boolean> }).approveToolCall
    expect(await approve({ toolName: 'get_application_program', input: {} })).toBe(false)
  })

  test('any OpenAI-compatible endpoint: OpenRouter by env', async () => {
    process.env.AGENT_API_KEY = 'or-key'
    process.env.AGENT_BASE_URL = 'https://openrouter.ai/api/v1'
    process.env.AGENT_MODEL = 'z-ai/glm-5.3-flash'
    expect(await (await GET()).json()).toMatchObject({ enabled: true, model: 'z-ai/glm-5.3-flash', provider: 'openrouter' })
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ network: 'mainnet', input: 'hi' }) }))
    expect((created.at(-1) as { model: { baseUrl: string; model: string } }).model).toMatchObject({ baseUrl: 'https://openrouter.ai/api/v1', model: 'z-ai/glm-5.3-flash' })
  })
})
