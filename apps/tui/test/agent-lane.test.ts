import { describe, expect, test } from 'bun:test'
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test'
import { z } from 'zod'

import { defineTool } from '@initlabs/vibekit-core'
import {
  createFixturePaymentHost,
  createFixtureResultStore,
  bridgeToolResult,
  unsignedGroupFromToolResult,
  FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_UNSIGNED_TRANSACTION,
  startPaymentFlowFromDraftRecord,
  type ToolResultEventLike,
} from '@initlabs/vibekit-experience'
import { draftRecordFromComposeWire } from '@initlabs/vibekit-experience/live'

import { resolveAgentConfig } from '@initlabs/vibekit-agent'
import {
  addResult,
  createAccountListViewModel,
  createResultStore,
} from '@initlabs/vibekit-experience'
import { withAccountNames } from '../src/keystore-host.js'

import {
  activeSenderLine,
  createExplorerAgent,
  explorerContext,
  explorerSystemPrompt,
  runAgentTurn,
} from '../src/agent-lane.js'

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
          { type: 'finish' as const, finishReason: { unified: 'tool-calls' as const, raw: 'tool-calls' }, usage: USAGE },
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
          { type: 'finish' as const, finishReason: { unified: 'stop' as const, raw: 'stop' }, usage: USAGE },
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
  feeMicroAlgos: 1000,
  confirmedRound: 22,
  paymentAmountMicroAlgos: 250000,
  receiver: 'L2MGM6VDPH7HME2IVMKLUYCLH5HWSZY7RQIMD5UCCTFNJ4M4DCBRXPSFJE',
}

const stubLookup = defineTool({
  name: 'lookup_transaction',
  description: 'stub',
  parameters: z.object({ txid: z.string() }),
  view: 'transaction.detail',
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
  test('activeSenderLine names the active account, with its label when known', () => {
    const book = [
      { address: TXN_WIRE.sender, name: 'SMOKE1' },
      { address: TXN_WIRE.receiver },
    ]
    expect(activeSenderLine(TXN_WIRE.sender, book)).toContain('SMOKE1')
    expect(activeSenderLine(TXN_WIRE.sender, book)).toContain('default sender')
    // Unlabeled active account: bare address, still a default-sender line.
    expect(activeSenderLine(TXN_WIRE.receiver, book)).toContain(TXN_WIRE.receiver)
    // No active account: no line.
    expect(activeSenderLine(undefined, book)).toBe('')
  })

  test('explorer context names the cards on screen, newest last', () => {
    const store = createFixtureResultStore()
    const context = explorerContext(store)
    expect(context.startsWith('Cards on screen')).toBe(true)
    expect(context).toContain('lookup_transaction')
    expect(context).toContain(`id=${FIXTURE_TRANSACTION_ID}`)
    expect(explorerContext(createResultStore([]))).toBe('')
  })

  test('keystore labels overlay onto account.list records and survive derivation', () => {
    const bridged = bridgeToolResult(
      {
        id: 'call-accounts-1',
        toolName: 'batch_lookup_accounts',
        output: {
          accounts: [
            { address: TXN_WIRE.sender, balanceMicroAlgos: 1000000 },
            { address: TXN_WIRE.receiver, balanceMicroAlgos: 2000000 },
          ],
        },
        view: 'account.list',
        isError: false,
      },
      { resultId: 'result-name-overlay', toolCallId: 'call-accounts-1', network: 'localnet' },
    )
    const named = withAccountNames(bridged.record, [
      { address: TXN_WIRE.sender, name: 'SMOKE1' },
      { address: TXN_WIRE.receiver },
    ])
    const store = addResult(createResultStore([]), named)
    const derived = createAccountListViewModel(store, {
      protocolVersion: named.protocolVersion,
      type: 'view',
      view: 'account.list',
      source: { source: 'result', id: 'result-name-overlay' },
    })
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.accounts[0]).toMatchObject({ address: TXN_WIRE.sender, name: 'SMOKE1' })
    expect(derived.model.accounts[1]!.name).toBeUndefined()
  })


  test('the explorer prompt tells the model to look up keystore accounts', () => {
    const prompt = explorerSystemPrompt(
      [{ name: 'batch_lookup_accounts' }, { name: 'lookup_account' }],
      'localnet',
      [{ address: TXN_WIRE.sender, name: 'SMOKE1' }],
    )
    expect(prompt).toContain('batch_lookup_accounts with every address below')
    expect(prompt).toContain('search_transactions with minRound and maxRound')
    expect(prompt).toContain('MUST call search_transactions')
    expect(prompt).toContain('Never write a transaction table')
    expect(prompt).toContain('ONE short sentence')
    expect(prompt).toContain('NEVER list, enumerate, restate')
    expect(prompt).toContain('search_account_transactions with txType')
    expect(prompt).toContain('lookup_transaction_group')
    expect(prompt).toContain('SMOKE1')
    expect(prompt).toContain(TXN_WIRE.sender)
    expect(prompt).toContain('resolve_nfd')
    expect(prompt).not.toContain('NEVER restate')
  })

  test('loads provider config from the environment', () => {
    // XDG points at an empty dir so a real ~/.config/vibekit file cannot leak in.
    const isolated = { XDG_CONFIG_HOME: '/nonexistent-vibekit-test' }
    expect(resolveAgentConfig(isolated)).toBeUndefined()
    expect(resolveAgentConfig({ ...isolated, VIBEKIT_AGENT_MODEL: 'qwen3:32b' })).toEqual({
      provider: 'ollama',
      model: 'qwen3:32b',
    })
    expect(
      resolveAgentConfig({
        ...isolated,
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

    const compose = unsignedGroupFromToolResult(toolResults[0]!)
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

  test('the default explorer agent registers resolve_nfd', async () => {
    const session = createExplorerAgent({
      model: new MockLanguageModelV4({
        doStream: toolCallThenText('resolve_nfd', { name: 'alice.algo' }, 'Need a live network for that.'),
      }),
      addressBook: [],
      network: 'localnet',
    })
    const toolResults: ToolResultEventLike[] = []
    await runAgentTurn(session, 'resolve alice.algo', {
      onText: () => {},
      onToolCall: () => {},
      onToolResult: (event) => toolResults.push(event),
      onError: () => {
        throw new Error('unexpected agent error')
      },
    })
    expect(toolResults).toHaveLength(1)
    expect(toolResults[0]?.toolName).toBe('resolve_nfd')
  })
})
