import { beforeEach, describe, expect, test } from 'bun:test'

import { createPaywall, memoryStore } from '../../src/pay/index.js'

const PAYER = 'WPR5O4HW43WM3R3RIGE7XT5QH3TSNER4VYJIGIT2CGS2SKX7P2Y724JCSQ'
const TOKEN = 'a'.repeat(64)
const store = memoryStore()
const paywall = createPaywall({ chain: 'testnet', payTo: PAYER, priceMicroUsdc: 1_000_000, turnsPerPack: 25, freeTurns: 2, store })
const { credits } = paywall
const request = (headers: Record<string, string> = {}, url = 'http://local/api/tools/x') =>
  new Request(url, { method: 'POST', headers: { 'x-forwarded-for': '9.9.9.9', ...headers } })

beforeEach(() => store.clear())

describe('the offer', () => {
  test('is whole base units per turn, USDC for the chain, the long x402 network id', () => {
    expect(paywall.offer).toMatchObject({ price: '$1.00', priceMicroUsdc: 1_000_000, pricePerTurnMicroUsdc: 40_000, asset: '10458941', chain: 'testnet' })
    expect(paywall.offer.network).toBe('algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=')
    expect(paywall.turnsRequested(request({}, 'http://x/?turns=50'))).toBe(50)
    expect(paywall.turnsRequested(request({}, 'http://x/?turns=0'))).toBe(25)
    expect(paywall.turnsRequested(request({}, 'http://x/?turns=5000'))).toBe(1000)
  })
})

describe('credits', () => {
  test('paid turns spend down to zero and refuse, untouched, after', async () => {
    expect(await credits.spend(PAYER)).toBeUndefined()
    expect(await credits.credit(PAYER)).toBe(25)
    expect(await credits.credit(PAYER, 5)).toBe(30)
    expect(await credits.spend(PAYER)).toBe(29)
    expect(await credits.balance(PAYER)).toBe(29)
  })

  test('free turns are per IP per day; tokens name the address that paid', async () => {
    const day = new Date('2026-08-28T10:00:00Z')
    expect(await credits.freeTurn('1.2.3.4', day)).toBe(1)
    expect(await credits.freeTurn('1.2.3.4', day)).toBe(0)
    expect(await credits.freeTurn('1.2.3.4', day)).toBeUndefined()
    expect(await credits.freeTurn('1.2.3.4', new Date('2026-08-29T10:00:00Z'))).toBe(1)
    await credits.bindToken(TOKEN, PAYER)
    expect(await credits.payerForToken(TOKEN)).toBe(PAYER)
    expect(await credits.payerForToken('not-hex')).toBeUndefined()
  })

  test('house caps: a day across everyone, an hour per ip, refused turns not counted', async () => {
    const at = new Date('2026-08-29T10:00:00Z')
    const caps = { daily: 3, hourly: 2 }
    expect(await credits.houseTurn('a', caps, at)).toBe('ok')
    expect(await credits.houseTurn('a', caps, at)).toBe('ok')
    expect(await credits.houseTurn('a', caps, at)).toBe('hourly')
    expect(await credits.houseTurn('b', caps, at)).toBe('ok')
    expect(await credits.houseTurn('b', caps, at)).toBe('daily')
    expect(await credits.houseTurn('a', caps, new Date('2026-08-30T00:00:00Z'))).toBe('ok')
  })
})

describe('charge', () => {
  test('free turns by IP first, then the bearer token, then 402; a stranger cannot spend an address', async () => {
    await credits.credit(PAYER)
    await credits.bindToken(TOKEN, PAYER)
    expect(await paywall.charge(request({ authorization: `Bearer ${TOKEN}` }))).toEqual({ ok: true, credits: { freeLeft: 1, paid: 25 } })
    expect(await paywall.charge(request())).toEqual({ ok: true, credits: { freeLeft: 0 } })
    const dry = await paywall.charge(request({ 'x-payer': PAYER }))
    if (dry.ok) throw new Error('expected 402')
    expect(dry.response.status).toBe(402)
    expect(((await dry.response.json()) as { offer: unknown }).offer).toEqual({ price: '$1.00', turns: 25 })
    const forged = await paywall.charge(request({ authorization: `Bearer ${'c'.repeat(64)}` }))
    expect(forged.ok).toBe(false)
    expect(await paywall.charge(request({ authorization: `Bearer ${TOKEN}` }))).toEqual({ ok: true, credits: { paid: 24, freeLeft: 0 } })
    expect(await paywall.status(request({ authorization: `Bearer ${TOKEN}` }))).toMatchObject({ payer: PAYER, paid: 24, freeLeft: 0, turnsPerPack: 25 })
  })
})
