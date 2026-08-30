/**
 * The share pipeline: the hash names exactly what the card displays, the
 * payload carries view blocks only, and the write path refuses rather than
 * degrades.
 */
import { afterEach, describe, expect, test } from 'bun:test'

import type { StructuredResult, ViewSpec } from '@initlabs/vibekit/actions'
import { createResultStore } from '@initlabs/vibekit/actions'

import type { Section } from './feed/hooks'
import { hashPayload, payloadFor, stripShareText, type SharePayload } from './share'

const { POST } = await import('../app/api/share/route.js')
const { resetMemoryShares, writeShare, readShare } = await import('../app/api/share/store.js')
const { resetMemoryLedger } = await import('../app/api/credits/ledger.js')

afterEach(() => {
  resetMemoryShares()
  resetMemoryLedger()
})

const record = (input?: Record<string, unknown>): StructuredResult =>
  ({
    protocolVersion: '0.1.0',
    type: 'result',
    resultId: 'r1',
    toolCallId: 'c1',
    toolName: 'get_account_portfolio',
    network: 'mainnet',
    state: 'success',
    data: { address: 'ABC', balance: 5 },
    ...(input ? { input } : {}),
  }) as StructuredResult

const view: ViewSpec = {
  protocolVersion: '0.1.0',
  type: 'view',
  view: 'account.portfolio',
  source: { source: 'result', id: 'r1' },
}

const payload = (over: Partial<SharePayload> = {}): SharePayload => ({
  prompt: 'what does this account hold?',
  reply: 'mostly ALGO, a little USDC.',
  network: 'mainnet',
  blocks: [{ view, record: record({ address: 'ABC', network: 'mainnet' }) }],
  ...over,
})

const post = (body: unknown) =>
  POST(new Request('http://x/api/share', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }))

describe('hashPayload', () => {
  test('12 lowercase hex characters, stable across key order in the record input', async () => {
    const a = await hashPayload(payload({ blocks: [{ view, record: record({ a: 1, b: 2 }) }] }))
    const b = await hashPayload(payload({ blocks: [{ view, record: record({ b: 2, a: 1 }) }] }))
    expect(a).toMatch(/^[0-9a-f]{12}$/)
    expect(b).toBe(a)
  })

  test('a different reply or a different prompt is a different URL', async () => {
    const base = await hashPayload(payload())
    expect(await hashPayload(payload({ reply: 'actually, nothing.' }))).not.toBe(base)
    expect(await hashPayload(payload({ prompt: 'and this one?' }))).not.toBe(base)
  })
})

describe('payloadFor', () => {
  const note = (text: string, extra: Partial<Extract<Section['items'][number], { kind: 'note' }>> = {}) =>
    ({ id: Math.random(), kind: 'note', text, tone: 'agent', ...extra }) as Section['items'][number]
  const section = (items: Section['items']): Section => ({
    id: 1,
    prompt: 'what does this account hold?',
    network: 'mainnet',
    items,
  })
  const store = createResultStore([record()])

  test('picks her last substantive note, not the narration, and keeps view blocks only', () => {
    const built = payloadFor(
      section([
        note('→ get_account_portfolio…'),
        { id: 2, kind: 'block', block: { kind: 'view', view } },
        { id: 3, kind: 'block', block: { kind: 'raw', title: 'x', text: '{}' } },
        { id: 4, kind: 'block', block: { kind: 'action', flow: {} as never } },
        note('mostly **ALGO**.'),
        note('still thinking…', { pending: true }),
      ]),
      store,
    )
    expect(built?.reply).toBe('mostly ALGO.')
    expect(built?.blocks).toHaveLength(1)
    expect(built?.blocks[0]?.view.view).toBe('account.portfolio')
  })

  test('a section she has not answered is not shareable', () => {
    expect(payloadFor(section([note('→ get_account_portfolio…')]), store)).toBeUndefined()
    expect(payloadFor(section([]), store)).toBeUndefined()
  })
})

describe('share route', () => {
  test('a valid POST returns /s/<12 hex>; re-sharing the same exchange is a no-op with the same URL', async () => {
    const first = await post(payload())
    expect(first.status).toBe(200)
    const { url } = (await first.json()) as { url: string }
    expect(url).toMatch(/^\/s\/[0-9a-f]{12}$/)
    const again = await post(payload())
    expect(again.status).toBe(200)
    expect(((await again.json()) as { url: string }).url).toBe(url)
    expect(await readShare(url.slice(3))).toMatchObject({ prompt: 'what does this account hold?' })
  })

  test('an oversized body is refused, not truncated', async () => {
    expect((await post(payload({ reply: 'x'.repeat(300 * 1024) }))).status).toBe(413)
  })

  test('garbage is a 400', async () => {
    expect((await post('not json')).status).toBe(400)
    expect((await post({ prompt: 'x' })).status).toBe(400)
  })

  test('a colliding hash with different content is refused; first write wins', async () => {
    expect(await writeShare('aaaaaaaaaaaa', payload())).toBe('created')
    expect(await writeShare('aaaaaaaaaaaa', payload())).toBe('identical')
    expect(await writeShare('aaaaaaaaaaaa', payload({ reply: 'different words.' }))).toBe('conflict')
  })
})

describe('stripShareText', () => {
  test('control characters and bidi overrides go, newlines stay', () => {
    expect(stripShareText('a\u202eb\u0007c')).toBe('a b c')
    expect(stripShareText('line one\nline two')).toBe('line one\nline two')
  })
})
