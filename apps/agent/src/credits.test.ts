import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { NextRequest } from 'next/server'

import { FIXTURE_SENDER } from '@initlabs/vibekit-explorer'

const env = { ...process.env }
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]
  Object.assign(process.env, env)
})

const ledger = await import('../app/api/credits/ledger.js')
const credits = await import('../app/api/credits/route.js')
const agent = await import('../app/api/agent/route.js')

beforeEach(() => ledger.resetMemoryLedger())

describe('credit ledger', () => {
  test('free turns go first, then a pack, then nothing', async () => {
    const free = ledger.FREE_TURNS
    for (let i = 0; i < free; i++) expect((await ledger.spend(FIXTURE_SENDER)).ok).toBe(true)
    expect(await ledger.spend(FIXTURE_SENDER)).toEqual({ ok: false, paid: 0, freeLeft: 0 })
    expect(await ledger.credit(FIXTURE_SENDER)).toBe(ledger.TURNS_PER_PACK)
    expect(await ledger.spend(FIXTURE_SENDER)).toEqual({ ok: true, paid: ledger.TURNS_PER_PACK - 1, freeLeft: 0 })
    expect(await ledger.balance(FIXTURE_SENDER)).toEqual({ paid: ledger.TURNS_PER_PACK - 1, freeLeft: 0 })
  })
})

describe('credits route', () => {
  test('is off without a house address', async () => {
    delete process.env.X402_PAY_TO
    const body = await (await credits.GET(new NextRequest('http://local/api/credits'))).json()
    expect(body).toMatchObject({ enabled: false, turnsPerPack: ledger.TURNS_PER_PACK, freeTurns: ledger.FREE_TURNS })
    expect((await credits.POST(new NextRequest('http://local/api/credits', { method: 'POST' }))).status).toBe(404)
  })

  test('names the pack and a payer balance when on', async () => {
    process.env.X402_PAY_TO = FIXTURE_SENDER
    process.env.AGENT_BILLING = 'x402'
    const body = await (await credits.GET(new NextRequest(`http://local/api/credits?payer=${FIXTURE_SENDER}`))).json()
    expect(body).toMatchObject({ enabled: true, price: '$1.00', chain: 'testnet', payTo: FIXTURE_SENDER, credits: { paid: 0, freeLeft: ledger.FREE_TURNS } })
    expect(body.network).toMatch(/^algorand:/)
  })
})

describe('agent route billing', () => {
  test('paid mode refuses a turn without a wallet, and once the address is dry', async () => {
    process.env.AGENT_API_KEY = 'test'
    process.env.X402_PAY_TO = FIXTURE_SENDER
    const post = (headers: Record<string, string>) =>
      agent.POST(
        new Request('http://local/api/agent', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify({ network: 'localnet', input: 'hi' }),
        }),
      )
    expect((await (await agent.GET()).json()).billing).toBe('x402')
    const noWallet = await post({})
    expect(noWallet.status).toBe(402)
    expect((await noWallet.json()).error).toMatch(/connect a wallet/i)
    for (let i = 0; i < ledger.FREE_TURNS; i++) await ledger.spend(FIXTURE_SENDER)
    const dry = await post({ 'x-payer': FIXTURE_SENDER })
    expect(dry.status).toBe(402)
    expect((await dry.json()).error).toMatch(/\/buy/)
  })
})
