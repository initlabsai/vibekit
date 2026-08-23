import { describe, expect, test } from 'bun:test'
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test'
import { z } from 'zod'

import { defineTool } from '@initlabs/vibekit-core'
import {
  createFixturePaymentHost,
  createFixtureResultStore,
  createApplicationMethodsViewModel,
  bridgeToolResult,
  unsignedGroupFromToolResult,
  FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_UNSIGNED_TRANSACTION,
  startPaymentFlowFromDraftRecord,
  type ToolResultEventLike,
} from '@initlabs/vibekit-explorer'
import { draftRecordFromComposeWire } from '@initlabs/vibekit-explorer/live'

import { resolveAgentConfig, type AgentEvent } from '@initlabs/vibekit-agent'
import { viewFor } from '../src/slices/lookup.js'
import { labelProgramMethods, specsByProgramHash } from '../src/abi-catalog.js'
import { normalizeAppSpec } from '@initlabs/vibekit-tools'
import { readFileSync } from 'node:fs'
import {
  addResult,
  createAccountListViewModel,
  createResultStore,
} from '@initlabs/vibekit-explorer'
import { withAccountNames } from '../src/keystore-host.js'

import {
  activeSenderLine,
  createExplorerAgent,
  explorerContext,
  explorerSystemPrompt,
  planToolResult,
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
    expect(prompt).toContain('never open two replies the same way')
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
          // Every network is served, so a write must name its network.
          { sender: TXN_WIRE.sender, receiver: TXN_WIRE.receiver, amountMicroAlgos: 250000, network: 'localnet' },
          'Review the payment in the panel.',
        ),
      }),
      addressBook: [],
      tools: [stubLookup, stubSendPayment],
    })

    const toolResults: Extract<AgentEvent, { type: 'tool-result' }>[] = []
    await runAgentTurn(session, 'pay 0.25 to the receiver', {
      onText: () => {},
      onToolCall: () => {},
      onToolResult: (event) => toolResults.push(event),
      onError: () => {
        throw new Error('unexpected agent error')
      },
    })

    expect((toolResults[0]!.input as { network?: string }).network).toBe('localnet')
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

describe('explain_application', () => {
  test('the agent’s markdown becomes a trusted explanation record', async () => {
    const { explainApplicationTool } = await import('../src/explain-tool.js')
    const output = await explainApplicationTool.handler(
      {} as never,
      { applicationId: 42, markdown: '## Pool\n- swap' },
    )
    const bridged = bridgeToolResult(
      { id: 'call-x', toolName: 'explain_application', output, view: 'application.explanation', isError: false },
      { resultId: newId('result-explain'), toolCallId: 'call-x', network: 'mainnet' },
    )
    expect(bridged.view).toBe('application.explanation')
    expect(bridged.record).toMatchObject({ state: 'success', data: { applicationId: 42, markdown: '## Pool\n- swap' } })
  })

  test('the explorer prompt routes explanations through the card', () => {
    const prompt = explorerSystemPrompt([], 'mainnet', [])
    expect(prompt).toContain('explain_application')
    expect(prompt).toContain('never audit')
  })
})

test('the methods view derives from a program record', () => {
  const program = {
    applicationId: 7,
    program: 'approval',
    bytes: 10,
    totalLines: 2,
    fromLine: 1,
    toLine: 2,
    teal: '#pragma version 10\nint 1',
    analysis: {
      version: 10,
      entrypoints: ['0x02bece11', 'bootstrap'],
      selectors: ['02bece11'],
      arc4Returns: true,
      strings: ['bootstrap'],
      stateKeys: { global: [], local: [], box: [] },
      guards: { rekey: false, closeRemainder: false, assetClose: false },
      innerTransactions: 0,
      onCompletion: [],
    },
    methods: [{ selector: '02bece11', name: 'hello', signature: 'hello(string)string' }],
  }
  const bridged = bridgeToolResult(
    { id: 'call-p', toolName: 'get_application_program', output: program, view: 'application.program', isError: false },
    { resultId: newId('result-program'), toolCallId: 'call-p', network: 'mainnet' },
  )
  const store = addResult(createFixtureResultStore(), bridged.record)
  const methods = createApplicationMethodsViewModel(store, viewFor(bridged.record, 'application.methods'))
  expect(methods.ok).toBe(true)
  if (methods.ok) expect(methods.model.analysis.entrypoints).toEqual(['0x02bece11', 'bootstrap'])
})

test('a known spec labels program selectors with names and args — inside the tool call', async () => {
  const spec = normalizeAppSpec(readFileSync(new URL('../../../packages/tools/test/fixtures/hello-world.arc56.json', import.meta.url), 'utf8'))
  // The spec matches by compiled-program hash, with no deploy record at all.
  const byHash = specsByProgramHash([{ spec }])
  expect(byHash.size).toBe(1)
  const hash = [...byHash.keys()][0]!
  const program = {
    applicationId: 1001,
    program: 'approval',
    programHash: hash,
    bytes: 1,
    totalLines: 1,
    fromLine: 1,
    toLine: 1,
    teal: '#pragma version 11',
    analysis: {
      entrypoints: ['0x02bece11', '0x4f92e173'],
      selectors: ['02bece11', '4f92e173'],
      arc4Returns: true,
      strings: [],
      stateKeys: { global: [], local: [], box: [] },
      guards: { rekey: false, closeRemainder: false, assetClose: false },
      innerTransactions: 0,
      onCompletion: [],
    },
    methods: [{ selector: '02bece11' }, { selector: '4f92e173' }],
  }
  const labelled = labelProgramMethods(program, new Map(), byHash)!
  expect(labelled[0]).toMatchObject({ name: 'hello', returns: 'string' })
  expect(labelled[1]).toMatchObject({ name: 'getMessage' })

  // And the model sees those names: the explorer agent labels before the result leaves the tool.
  const stubProgram = defineTool({
    name: 'get_application_program',
    description: 'stub',
    parameters: z.object({ applicationId: z.number() }),
    handler: async () => program,
  })
  const session = createExplorerAgent({
    model: new MockLanguageModelV4({
      doStream: toolCallThenText('get_application_program', { applicationId: 1001 }, 'Done.'),
    }),
    addressBook: [],
    tools: [stubProgram],
    labelProgram: (p) => labelProgramMethods(p as typeof program, new Map(), byHash),
  })
  const outputs: unknown[] = []
  await runAgentTurn(session, 'explain app 1001', {
    onText: () => {},
    onToolCall: () => {},
    onToolResult: (event) => outputs.push(event.output),
    onError: () => {
      throw new Error('unexpected agent error')
    },
  })
  expect((outputs[0] as { methods: Array<{ name?: string }> }).methods.map((m) => m.name)).toEqual(['hello', 'getMessage'])
})

describe('planToolResult', () => {
  const ctx = {
    sessionNetwork: 'localnet' as const,
    paymentInFlight: false,
    newId,
    specCatalog: new Map(),
    addressBook: [{ address: TXN_WIRE.sender, name: 'SMOKE1' }],
  }
  const result = (toolName: string, output: unknown, extra: Record<string, unknown> = {}) =>
    ({ type: 'tool-result' as const, id: 'call-1', toolName, output, isError: false, ...extra })

  test('a viewed result is one card on the network the call named', () => {
    const plan = planToolResult(
      result('lookup_transaction', TXN_WIRE, { view: 'transaction.detail', input: { network: 'mainnet' } }),
      ctx,
    )
    expect(plan.usedNetwork).toBe('mainnet')
    if (plan.kind !== 'cards') throw new Error(plan.kind)
    expect(plan.record.network).toBe('mainnet')
    expect(plan.blocks.map((block) => (block.kind === 'view' ? block.view.view : block.kind))).toEqual([
      'transaction.detail',
    ])
  })

  test('a composed group is a payment — unless one is already awaiting approval', () => {
    const compose = result('send_payment', {
      unsignedGroup: [PAYMENT_FIXTURE_UNSIGNED_TRANSACTION],
      summary: 'pay 0.25 ALGO',
      network: 'localnet',
    })
    expect(planToolResult(compose, ctx).kind).toBe('payment')
    const second = planToolResult(compose, { ...ctx, paymentInFlight: true })
    if (second.kind !== 'cards') throw new Error(second.kind)
    expect(second.blocks[0]?.kind).toBe('raw')
  })

  test('the first approval page brings its methods card along', () => {
    const program = {
      applicationId: 7,
      program: 'approval',
      programHash: 'deadbeef',
      bytes: 10,
      totalLines: 2,
      fromLine: 1,
      toLine: 2,
      teal: '#pragma version 10\nint 1',
      analysis: {
        version: 10,
        entrypoints: ['0x02bece11'],
        selectors: ['02bece11'],
        arc4Returns: true,
        strings: [],
        stateKeys: { global: [], local: [], box: [] },
        guards: { rekey: false, closeRemainder: false, assetClose: false },
        innerTransactions: 0,
        onCompletion: [],
      },
      methods: [{ selector: '02bece11' }],
    }
    const first = planToolResult(result('get_application_program', program, { view: 'application.program' }), ctx)
    if (first.kind !== 'cards') throw new Error(first.kind)
    expect(first.blocks.map((block) => (block.kind === 'view' ? block.view.view : block.kind))).toEqual([
      'application.program',
      'application.methods',
    ])
    const later = planToolResult(
      result('get_application_program', { ...program, fromLine: 3, toLine: 4 }, { view: 'application.program' }),
      ctx,
    )
    if (later.kind !== 'cards') throw new Error(later.kind)
    expect(later.blocks).toHaveLength(1)
  })

  test('a plugin-declared view renders its card only when the wire parses', () => {
    const nfd = { name: 'alice.algo', address: TXN_WIRE.sender, state: 'owned' }
    const plan = planToolResult(result('resolve_nfd', nfd, { view: 'nfd.profile', input: { network: 'mainnet' } }), ctx)
    if (plan.kind !== 'cards') throw new Error(plan.kind)
    expect(plan.blocks[0]).toMatchObject({ kind: 'plugin', view: 'nfd.profile', network: 'mainnet' })
    expect(plan.note).toBeUndefined()

    // A wire that misses the plugin's schema degrades to raw, and says so.
    const bad = planToolResult(result('resolve_nfd', { appId: 'seven' }, { view: 'nfd.profile' }), ctx)
    if (bad.kind !== 'cards') throw new Error(bad.kind)
    expect(bad.blocks[0]?.kind).toBe('raw')
    expect(bad.note).toContain('nfd.profile')
  })

  test('a view cue whose wire does not parse shows raw and says so', () => {
    const { programHash: _dropped, ...incomplete } = {
      applicationId: 7,
      programHash: 'deadbeef',
      program: 'approval',
      bytes: 10,
      totalLines: 1,
      fromLine: 1,
      toLine: 1,
      teal: 'int 1',
    }
    const plan = planToolResult(result('get_application_program', incomplete, { view: 'application.program' }), ctx)
    if (plan.kind !== 'cards') throw new Error(plan.kind)
    expect(plan.blocks[0]?.kind).toBe('raw')
    expect(plan.note).toContain('application.program')
    expect(plan.note).toContain('programHash')
  })
})
