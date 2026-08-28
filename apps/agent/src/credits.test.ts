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

const TOKEN = 'a'.repeat(64)
beforeEach(() => ledger.resetMemoryLedger())

describe('credit ledger', () => {
  test('paid turns spend down to zero and refuse, untouched, after', async () => {
    expect(await ledger.spend(FIXTURE_SENDER)).toBeUndefined()
    expect(await ledger.credit(FIXTURE_SENDER)).toBe(ledger.TURNS_PER_PACK)
    expect(await ledger.credit(FIXTURE_SENDER, 5)).toBe(ledger.TURNS_PER_PACK + 5)
    expect(await ledger.spend(FIXTURE_SENDER)).toBe(ledger.TURNS_PER_PACK + 4)
    expect(await ledger.spend(FIXTURE_SENDER)).toBe(ledger.TURNS_PER_PACK + 3)
    expect(await ledger.balance(FIXTURE_SENDER)).toBe(ledger.TURNS_PER_PACK + 3)
  })

  test('free turns are per IP per day', async () => {
    const day = new Date('2026-08-28T10:00:00Z')
    for (let i = ledger.FREE_TURNS - 1; i >= 0; i--) expect(await ledger.freeTurn('1.2.3.4', day)).toBe(i)
    expect(await ledger.freeTurn('1.2.3.4', day)).toBeUndefined()
    expect(await ledger.freeLeft('1.2.3.4', day)).toBe(0)
    expect(await ledger.freeTurn('5.6.7.8', day)).toBe(ledger.FREE_TURNS - 1)
    expect(await ledger.freeTurn('1.2.3.4', new Date('2026-08-29T10:00:00Z'))).toBe(ledger.FREE_TURNS - 1)
  })

  test('a token names the address that paid; anything else names nobody', async () => {
    await ledger.bindToken(TOKEN, FIXTURE_SENDER)
    expect(await ledger.payerForToken(TOKEN)).toBe(FIXTURE_SENDER)
    expect(await ledger.payerForToken('b'.repeat(64))).toBeUndefined()
    expect(await ledger.payerForToken('not-hex')).toBeUndefined()
    expect(ledger.bearerOf(new Request('http://x', { headers: { authorization: `Bearer ${TOKEN}` } }))).toBe(TOKEN)
  })
})

describe('credits route', () => {
  test('reads the buyer token from the settle context, wrapped or bare', () => {
    const adapter = { getHeader: (name: string) => (name === 'x-credit-token' ? TOKEN : undefined) }
    expect(credits.creditTokenOf({ request: { adapter }, responseBody: '', responseHeaders: {} })).toBe(TOKEN)
    expect(credits.creditTokenOf({ adapter })).toBe(TOKEN)
    expect(credits.creditTokenOf({ request: { adapter: { getHeader: () => 'nope' } } })).toBeUndefined()
    expect(credits.creditTokenOf(undefined)).toBeUndefined()
  })

  test('is off without a house address', async () => {
    delete process.env.X402_PAY_TO
    const body = await (await credits.GET(new NextRequest('http://local/api/credits'))).json()
    expect(body).toMatchObject({ enabled: false, turnsPerPack: ledger.TURNS_PER_PACK, freeTurns: ledger.FREE_TURNS, freeLeft: ledger.FREE_TURNS })
    expect(body.payer).toBeUndefined()
    expect((await credits.POST(new NextRequest('http://local/api/credits', { method: 'POST' }))).status).toBe(404)
  })

  test('names the pack, and the bearer balance when a token is bound', async () => {
    process.env.X402_PAY_TO = FIXTURE_SENDER
    process.env.AGENT_BILLING = 'x402'
    await ledger.bindToken(TOKEN, FIXTURE_SENDER)
    await ledger.credit(FIXTURE_SENDER)
    const body = await (await credits.GET(new NextRequest('http://local/api/credits', { headers: { authorization: `Bearer ${TOKEN}` } }))).json()
    expect(body).toMatchObject({ enabled: true, price: '$1.00', priceMicroUsdc: 1_000_000, pricePerTurnMicroUsdc: 40_000, asset: '10458941', chain: 'testnet', payTo: FIXTURE_SENDER, payer: FIXTURE_SENDER, paid: ledger.TURNS_PER_PACK })
    expect(body.network).toBe('algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=')
  })
})

describe('credits price', () => {
  test('is an integer in USDC base units, formatted for people', async () => {
    const { creditsConfig, formatUsdc } = await import('../app/api/credits/config.js')
    process.env.X402_PAY_TO = FIXTURE_SENDER
    process.env.X402_PRICE_MICROUSDC = '250000'
    expect(creditsConfig()).toMatchObject({ priceMicroUsdc: 250_000, price: '$0.25' })
    process.env.X402_PRICE_MICROUSDC = '1.5'
    expect(creditsConfig()?.priceMicroUsdc).toBe(1_000_000)
    expect(formatUsdc(1_000_000)).toBe('$1.00')
    process.env.X402_ASSET_ID = '31566704'
    expect(creditsConfig()?.asset).toBe('31566704')
  })

  test('X402_NETWORK picks the chain even in production', async () => {
    const { creditsConfig } = await import('../app/api/credits/config.js')
    process.env.X402_PAY_TO = FIXTURE_SENDER
    process.env.VERCEL = '1'
    expect(creditsConfig()?.chain).toBe('mainnet')
    process.env.X402_NETWORK = 'testnet'
    expect(creditsConfig()).toMatchObject({ chain: 'testnet', asset: '10458941' })
  })

  test('turns requested clamp to the pack by default and to the cap at most', async () => {
    const { turnsRequested, MAX_TURNS_PER_BUY } = await import('../app/api/credits/config.js')
    expect(turnsRequested(null)).toBe(ledger.TURNS_PER_PACK)
    expect(turnsRequested('50')).toBe(50)
    expect(turnsRequested('0')).toBe(ledger.TURNS_PER_PACK)
    expect(turnsRequested('2.5')).toBe(ledger.TURNS_PER_PACK)
    expect(turnsRequested(String(MAX_TURNS_PER_BUY * 3))).toBe(MAX_TURNS_PER_BUY)
  })
})

describe('agent route billing', () => {
  test('paid mode: free turns by IP, then 402; a stranger cannot spend an address', async () => {
    process.env.AGENT_API_KEY = 'test'
    // The stream a 200 opens would call the model; a dead port makes that a fast, quiet failure.
    process.env.AGENT_BASE_URL = 'http://127.0.0.1:9/v1'
    process.env.X402_PAY_TO = FIXTURE_SENDER
    await ledger.credit(FIXTURE_SENDER)
    const post = (headers: Record<string, string>) =>
      agent.POST(
        new Request('http://local/api/agent', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9', ...headers },
          body: JSON.stringify({ network: 'localnet', input: 'hi' }),
        }),
      )
    expect((await (await agent.GET()).json()).billing).toBe('x402')
    // A bound token with free turns left still spends the free one first.
    await ledger.bindToken(TOKEN, FIXTURE_SENDER)
    const first = await post({ authorization: `Bearer ${TOKEN}` })
    expect(first.status).toBe(200)
    expect(await ledger.balance(FIXTURE_SENDER)).toBe(ledger.TURNS_PER_PACK)
    expect(await ledger.freeLeft('9.9.9.9')).toBe(ledger.FREE_TURNS - 1)
    for (let i = 0; i < ledger.FREE_TURNS; i++) await ledger.freeTurn('9.9.9.9')
    const dry = await post({ 'x-payer': FIXTURE_SENDER })
    expect(dry.status).toBe(402)
    expect((await dry.json()).error).toMatch(/\/buy/)
    expect(await ledger.balance(FIXTURE_SENDER)).toBe(ledger.TURNS_PER_PACK)
    const forged = await post({ authorization: `Bearer ${'c'.repeat(64)}` })
    expect(forged.status).toBe(402)
    expect(await ledger.balance(FIXTURE_SENDER)).toBe(ledger.TURNS_PER_PACK)
  })
})
