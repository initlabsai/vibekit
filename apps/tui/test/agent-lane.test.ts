import { describe, expect, test } from 'bun:test'
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test'
import { z } from 'zod'

import { defineTool } from '@initlabs/vibekit-core'
import {
  createFixturePaymentHost,
  createFixtureResultStore,
  bridgeToolResult,
  paymentComposeFromToolResult,
  PAYMENT_FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_UNSIGNED_TRANSACTION,
  startPaymentFlowFromDraftRecord,
  type ToolResultEventLike,
} from '@initlabs/vibekit-experience'
import { draftRecordFromComposeWire } from '@initlabs/vibekit-experience/live'

import { createExplorerAgent, loadAgentConfig, runAgentTurn } from '../src/agent-lane.js'

const USAGE = {
  inputTokens: { total: 10, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: undefined, reasoning: undefined },
} as never

function toolCallThenText(toolName: string, input: Record<string, unknown>, text: string) {
  // Chunk/usage literal types drifted across ai versions; runtime shapes match.
  return [
    {
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start' as const, warnings: [] },
          {
            type: 'tool-call' as const,
            toolCallId: 'call-1',
            toolName,
            input: JSON.stringify(input),
          },
          { type: 'finish' as const, finishReason: 'tool-calls' as const, usage: USAGE },
        ] as never,
      }),
    },
    {
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start' as const, warnings: [] },
          { type: 'text-start' as const, id: 't1' },
          { type: 'text-delta' as const, id: 't1', delta: text },
          { type: 'text-end' as const, id: 't1' },
          { type: 'finish' as const, finishReason: 'stop' as const, usage: USAGE },
        ] as never,
      }),
    },
  ] as never
}

/** The recorded lookup_transaction wire, served by a stub tool. */
const TXN_WIRE = {
  id: PAYMENT_FIXTURE_TRANSACTION_ID,
  type: 'pay',
  sender: 'WPR5O4HW43WM3R3RIGE7XT5QH3TSNER4VYJIGIT2CGS2SKX7P2Y724JCSQ',
  fee: 0.001,
  confirmedRound: 22,
  paymentAmount: 0.25,
  receiver: 'L2MGM6VDPH7HME2IVMKLUYCLH5HWSZY7RQIMD5UCCTFNJ4M4DCBRXPSFJE',
}

const stubLookup = defineTool({
  name: 'lookup_transaction',
  description: 'stub',
  parameters: z.object({ txid: z.string() }),
  handler: async () => TXN_WIRE,
})

const stubSendPayment = defineTool({
  name: 'send_payment',
  description: 'stub',
  parameters: z.object({
    sender: z.string(),
    receiver: z.string(),
    amountMicroAlgos: z.number(),
  }),
  requiresSigner: true,
  handler: async () => ({
    unsignedGroup: [PAYMENT_FIXTURE_UNSIGNED_TRANSACTION],
    summary: 'stub summary',
  }),
})

let counter = 0
const newId = (prefix: string) => `${prefix}-${++counter}`

describe('TUI agent lane', () => {
  test('loads provider config from the environment', () => {
    expect(loadAgentConfig({})).toBeUndefined()
    expect(loadAgentConfig({ VIBEKIT_AGENT_MODEL: 'qwen3:32b' })).toEqual({
      provider: 'ollama',
      model: 'qwen3:32b',
    })
    expect(
      loadAgentConfig({
        VIBEKIT_AGENT_MODEL: 'gpt-5',
        VIBEKIT_AGENT_PROVIDER: 'openai-compatible',
        VIBEKIT_AGENT_BASE_URL: 'http://box:8000/v1',
        VIBEKIT_AGENT_API_KEY: 'k',
      }),
    ).toEqual({
      provider: 'openai-compatible',
      model: 'gpt-5',
      baseUrl: 'http://box:8000/v1',
      apiKey: 'k',
    })
  })

  test('a question turns into a tool call, a trusted view, and narration', async () => {
    const session = createExplorerAgent({
      model: new MockLanguageModelV4({
        doStream: toolCallThenText(
          'lookup_transaction',
          { txid: PAYMENT_FIXTURE_TRANSACTION_ID },
          'Opened it for you.',
        ),
      }),
      addressBook: [{ address: TXN_WIRE.sender, name: 'SMOKE1' }],
      tools: [stubLookup, stubSendPayment],
    })

    let narration = ''
    const toolResults: ToolResultEventLike[] = []
    await runAgentTurn(session, 'show me that transaction', {
      onText: (delta) => (narration += delta),
      onToolCall: () => {},
      onToolResult: (event) => toolResults.push(event),
      onError: () => {
        throw new Error('unexpected agent error')
      },
    })

    expect(narration).toBe('Opened it for you.')
    expect(toolResults).toHaveLength(1)
    const bridged = bridgeToolResult(toolResults[0]!, {
      resultId: newId('result-agent'),
      toolCallId: toolResults[0]!.id,
      network: 'localnet',
    })
    expect(bridged.record).toMatchObject({
      toolName: 'lookup_transaction',
      data: { paymentAmountMicroAlgos: 250000 },
    })
    expect(bridged.view).toBe('transaction.detail')
  })

  test('an agent-composed payment lands on the same approval card', async () => {
    const session = createExplorerAgent({
      model: new MockLanguageModelV4({
        doStream: toolCallThenText(
          'send_payment',
          { sender: TXN_WIRE.sender, receiver: TXN_WIRE.receiver, amountMicroAlgos: 250000 },
          'Review the payment in the panel.',
        ),
      }),
      addressBook: [],
      tools: [stubLookup, stubSendPayment],
    })

    const toolResults: ToolResultEventLike[] = []
    await runAgentTurn(session, 'pay 0.25 to the receiver', {
      onText: () => {},
      onToolCall: () => {},
      onToolResult: (event) => toolResults.push(event),
      onError: () => {
        throw new Error('unexpected agent error')
      },
    })

    const compose = paymentComposeFromToolResult(toolResults[0]!)
    expect(compose?.unsignedGroup).toEqual([PAYMENT_FIXTURE_UNSIGNED_TRANSACTION])

    const draftRecord = draftRecordFromComposeWire(
      { resultId: newId('result-agent-draft'), toolCallId: 'call-1', network: 'localnet' },
      compose,
    )
    const run = await startPaymentFlowFromDraftRecord({
      host: createFixturePaymentHost(),
      store: createFixtureResultStore(),
      draftRecord,
      newId,
    })
    if (!run.ok || !run.flow) throw new Error(run.message)
    // The one human decision: the agent got the flow to the approval card, no further.
    expect(run.flow.stage).toBe('awaiting-approval')
    expect(run.flow.signed).toBeUndefined()
  })
})
