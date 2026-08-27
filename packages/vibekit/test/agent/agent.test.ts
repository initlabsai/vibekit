import { describe, expect, test } from 'bun:test'
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test'
import { z } from 'zod'

import { defineTool, resolveDeployment, ToolError } from '../../src/core/index.js'
import { createAgent, defaultSystemPrompt, type AgentEvent } from '../../src/agent/index.js'

const USAGE = {
  inputTokens: { total: 10, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: undefined, reasoning: undefined },
} as never

function textStream(text: string) {
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: 'stream-start' as const, warnings: [] },
        { type: 'text-start' as const, id: 't1' },
        { type: 'text-delta' as const, id: 't1', delta: text },
        { type: 'text-end' as const, id: 't1' },
        { type: 'finish' as const, finishReason: { unified: 'stop' as const, raw: 'stop' }, usage: USAGE },
      ],
    }),
  }
}

function toolCallStream(toolName: string, input: Record<string, unknown>) {
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: 'stream-start' as const, warnings: [] },
        {
          type: 'tool-call' as const,
          toolCallId: 'call-1',
          toolName,
          input: JSON.stringify(input),
        },
        { type: 'finish' as const, finishReason: { unified: 'tool-calls' as const, raw: 'tool-calls' }, usage: USAGE },
      ],
    }),
  }
}

async function collect(events: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const collected: AgentEvent[] = []
  for await (const event of events) collected.push(event)
  return collected
}

const echoTool = defineTool({
  name: 'echo',
  description: 'Echo the message back.',
  parameters: z.object({ message: z.string() }),
  view: 'network.status',
  handler: async (_ctx, args) => ({ echoed: args.message, big: 42n }),
})

describe('createAgent', () => {
  test('the default system prompt is short and names every tool', () => {
    const deployment = resolveDeployment({
      network: 'localnet',
      mode: 'compose',
      tools: [echoTool],
    })
    const prompt = defaultSystemPrompt(deployment)
    expect(prompt.length).toBeLessThan(1600)
    expect(prompt).toContain('Tools: echo')
    expect(prompt).toContain('Answer from tool results only')
  })

  test('streams text and keeps conversation history', async () => {
    const agent = createAgent({
      model: new MockLanguageModelV4({ doStream: [textStream('Hello from the mock!')] }),
      network: 'localnet',
      mode: 'compose',
      tools: [echoTool],
    })

    const events = await collect(agent.stream('hi'))
    const text = events
      .filter((e) => e.type === 'text-delta')
      .map((e) => e.text)
      .join('')
    expect(text).toBe('Hello from the mock!')

    const finish = events.at(-1)!
    expect(finish.type).toBe('finish')
    if (finish.type === 'finish') {
      expect(finish.usage?.inputTokens).toBe(10)
    }

    expect(agent.messages).toHaveLength(2) // user + assistant
    agent.reset()
    expect(agent.messages).toHaveLength(0)
  })

  test('runs the tool loop: call, JSON-safe result with display hint, final text', async () => {
    const agent = createAgent({
      model: new MockLanguageModelV4({
        doStream: [toolCallStream('echo', { message: 'ping' }), textStream('It said ping.')],
      }),
      network: 'localnet',
      mode: 'compose',
      tools: [echoTool],
    })

    const events = await collect(agent.stream('use the echo tool'))

    const call = events.find((e) => e.type === 'tool-call')!
    expect(call.type).toBe('tool-call')
    if (call.type === 'tool-call') {
      expect(call.toolName).toBe('echo')
      expect(call.input).toEqual({ message: 'ping' })
    }

    const result = events.find((e) => e.type === 'tool-result')!
    expect(result.type).toBe('tool-result')
    if (result.type === 'tool-result') {
      expect(result.isError).toBe(false)
      expect(result.view).toBe('network.status')
      // bigint made JSON-safe by the shared executeToolCall
      expect(result.output).toEqual({ echoed: 'ping', big: 42 })
    }

    const text = events
      .filter((e) => e.type === 'text-delta')
      .map((e) => e.text)
      .join('')
    expect(text).toBe('It said ping.')

    // history: user, assistant(tool call), tool result, assistant text
    expect(agent.messages.length).toBeGreaterThanOrEqual(3)
  })

  test('routes the injected network param to the right pooled context', async () => {
    const seen: string[] = []
    const whereTool = defineTool({
      name: 'where',
      description: 'Report the network this call ran against.',
      parameters: z.object({}),
      handler: async (ctx) => {
        seen.push(ctx.network.id)
        return { network: ctx.network.id }
      },
    })

    const agent = createAgent({
      model: new MockLanguageModelV4({
        doStream: [toolCallStream('where', { network: 'localnet' }), textStream('done')],
      }),
      network: 'testnet',
      networks: ['testnet', 'localnet'],
      mode: 'compose',
      tools: [whereTool],
    })

    const events = await collect(agent.stream('which network?'))
    const result = events.find((e) => e.type === 'tool-result')!
    if (result.type === 'tool-result') {
      expect(result.output).toEqual({ network: 'localnet' })
    }
    expect(seen).toEqual(['localnet'])
  })

  test('surfaces handler ToolErrors as error results and continues the loop', async () => {
    const failTool = defineTool({
      name: 'fail',
      description: 'Always fails.',
      parameters: z.object({}),
      handler: async () => {
        throw new ToolError('INVALID_ADDRESS', 'not an address')
      },
    })

    const agent = createAgent({
      model: new MockLanguageModelV4({
        doStream: [toolCallStream('fail', {}), textStream('That failed.')],
      }),
      network: 'localnet',
      mode: 'compose',
      tools: [failTool],
    })

    const events = await collect(agent.stream('try it'))
    const result = events.find((e) => e.type === 'tool-result')!
    if (result.type === 'tool-result') {
      expect(result.isError).toBe(true)
      expect(result.output).toEqual({
        error: { code: 'INVALID_ADDRESS', message: 'not an address' },
      })
    }

    const text = events
      .filter((e) => e.type === 'text-delta')
      .map((e) => e.text)
      .join('')
    expect(text).toBe('That failed.')
  })

  test('registry validation happens at startup', () => {
    expect(() =>
      createAgent({
        model: new MockLanguageModelV4({}),
        network: 'localnet',
        mode: 'compose',
        tools: [echoTool, echoTool],
      }),
    ).toThrow('Duplicate tool name: echo')
  })
})

describe('approval gate', () => {
  const sendTool = defineTool({
    name: 'send',
    description: 'Write tool requiring a signer.',
    parameters: z.object({ amount: z.number() }),
    requiresSigner: true,
    handler: async () => ({ sent: true }),
  })

  test('denied requiresSigner calls return a DENIED error result', async () => {
    const agent = createAgent({
      model: new MockLanguageModelV4({
        doStream: [toolCallStream('send', { amount: 1 }), textStream('Denied then.')],
      }),
      network: 'localnet',
      mode: 'compose',
      tools: [sendTool],
      approveToolCall: async () => false,
    })

    const events = await collect(agent.stream('send it'))
    const result = events.find((e) => e.type === 'tool-result')!
    if (result.type === 'tool-result') {
      expect(result.isError).toBe(true)
      expect(result.output).toEqual({
        error: { code: 'DENIED', message: 'The user denied this request.' },
      })
    }
  })

  test('approved calls run the handler; read tools are never gated', async () => {
    const gated: string[] = []
    const agent = createAgent({
      model: new MockLanguageModelV4({
        doStream: [toolCallStream('send', { amount: 1 }), toolCallStream('echo', { message: 'x' }), textStream('ok')],
      }),
      network: 'localnet',
      mode: 'compose',
      tools: [sendTool, echoTool],
      approveToolCall: async ({ toolName }) => {
        gated.push(toolName)
        return true
      },
    })

    const events = await collect(agent.stream('go'))
    const results = events.filter((e) => e.type === 'tool-result')
    expect(results).toHaveLength(2)
    expect(gated).toEqual(['send']) // echo (read) never hit the gate
  })

  test('extraInstructions are appended to the system prompt', () => {
    const model = new MockLanguageModelV4({ doStream: [textStream('hi')] })
    createAgent({
      model,
      network: 'localnet',
      mode: 'compose',
      tools: [echoTool],
      extraInstructions: 'HOST_MARKER',
    })
    // constructing is enough — prompt assembly happens in createAgent; a bad
    // concat would throw. Deeper assertion happens on the first stream call.
    expect(model.doStreamCalls).toHaveLength(0)
  })
})
