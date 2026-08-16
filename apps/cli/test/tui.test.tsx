import { describe, expect, test } from 'bun:test'
import React from 'react'
import { render } from 'ink-testing-library'

import type { AgentEvent, AgentSession } from '@initlabs/vibekit-agent'
import { ExploreApp, type ApprovalBridge } from '../src/commands/explore/app.js'
import { ApprovalCard, ResultBody } from '../src/commands/explore/components.js'
import { Markdown } from '../src/commands/explore/markdown.js'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (check()) return
    await sleep(20)
  }
  throw new Error('waitFor timed out')
}

describe('Markdown', () => {
  test('styles headers, bullets, and inline spans without markers', () => {
    const { lastFrame } = render(
      <Markdown>{'# Title\n- item with **bold** and `code`\nplain [link](https://x.dev)'}</Markdown>,
    )
    const frame = lastFrame()!
    expect(frame).toContain('Title')
    expect(frame).toContain('• item with bold and code')
    expect(frame).not.toContain('**')
    expect(frame).not.toContain('`')
    expect(frame).toContain('link (https://x.dev)')
  })
})

describe('ResultBody', () => {
  test('renders table hint as aligned columns', () => {
    const { lastFrame } = render(
      <ResultBody
        output={{ accounts: [{ address: 'AAAA', amount: 5 }, { address: 'BBBB', amount: 7 }] }}
        display="table"
      />,
    )
    const frame = lastFrame()!
    expect(frame).toMatch(/address\s+amount/)
    expect(frame).toMatch(/AAAA\s+5/)
  })

  test('renders account hint as key/value lines', () => {
    const { lastFrame } = render(
      <ResultBody output={{ address: 'AAAA', status: 'Online' }} display="account" />,
    )
    expect(lastFrame()!).toMatch(/address\s+AAAA/)
    expect(lastFrame()!).toMatch(/status\s+Online/)
  })
})

describe('ApprovalCard', () => {
  test('y approves, n denies', async () => {
    let outcome: boolean | undefined
    const { stdin, lastFrame } = render(
      <ApprovalCard
        pending={{ toolName: 'send_payment', input: { amount: 1 }, resolve: (v) => (outcome = v) }}
      />,
    )
    expect(lastFrame()!).toContain('Approval required')
    expect(lastFrame()!).toContain('send_payment')
    await sleep(20)
    stdin.write('y')
    await waitFor(() => outcome === true)

    outcome = undefined
    const denied = render(
      <ApprovalCard
        pending={{ toolName: 'send_payment', input: {}, resolve: (v) => (outcome = v) }}
      />,
    )
    await sleep(20)
    denied.stdin.write('n')
    await waitFor(() => outcome === false)
  })
})

function fakeSession(events: AgentEvent[]): AgentSession {
  return {
    messages: [],
    reset() {},
    async *stream() {
      for (const event of events) {
        await sleep(5)
        yield event
      }
    },
  }
}

describe('ExploreApp', () => {
  test('streams a full turn: user echo, tool chip, result card, answer text', async () => {
    const session = fakeSession([
      { type: 'text-delta', text: 'Looking that up. ' },
      { type: 'tool-call', id: '1', toolName: 'lookup_account', input: { address: 'AAAA' } },
      {
        type: 'tool-result',
        id: '1',
        toolName: 'lookup_account',
        output: { address: 'AAAA', amount: 5 },
        display: 'account',
        isError: false,
      },
      { type: 'text-delta', text: 'It holds 5 ALGO.' },
      { type: 'finish', finishReason: 'stop' },
    ])

    const bridge: ApprovalBridge = {}
    const { stdin, lastFrame, frames } = render(
      <ExploreApp
        session={session}
        model="ollama/test"
        networks={['mainnet', 'testnet']}
        defaultNetwork="mainnet"
        approvalBridge={bridge}
      />,
    )

    await waitFor(() => lastFrame()!.includes('✦ vibekit'))
    await sleep(30)
    stdin.write('who owns AAAA?')
    await sleep(30)
    stdin.write('\r')

    const everything = () => frames.join('\n')
    await waitFor(() => everything().includes('⚙ lookup_account'))
    await waitFor(() => everything().includes('It holds 5 ALGO.'))
    expect(everything()).toContain('who owns AAAA?')
    expect(everything()).toMatch(/address\s+AAAA/)
    expect(everything()).toContain('read-only')
  })
})
