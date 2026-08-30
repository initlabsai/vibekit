/**
 * The paywall: one x402 payment in USDC buys turns for the paying address;
 * each call takes a free turn (per IP per day) or a paid one, or gets a 402.
 * The rule that turns a settled amount into credit lives here — never a
 * count the caller sent. Mount `buy` on a purchase route and put `charge`
 * in front of whatever costs a turn: a query, an MCP call, an agent turn.
 */
import { USDC_DECIMALS, USDC_MAINNET_ASA_ID, USDC_TESTNET_ASA_ID } from '@x402/avm'

import { bearerOf, createCredits, ipOf, TOKEN_PATTERN, type Credits } from './credits.js'
import type { PayStore } from './store.js'
import { createX402Gate, x402Network, type Handler } from './x402.js'

export interface PaywallOptions {
  chain: 'mainnet' | 'testnet'
  /** The house address payments go to. */
  payTo: string
  /** ASA id; USDC for the chain when omitted. */
  asset?: string
  facilitatorUrl?: string
  /** The default pack in USDC base units (6 decimals); 1_000_000 = $1.00. */
  priceMicroUsdc?: number
  turnsPerPack?: number
  maxTurnsPerBuy?: number
  /** Free turns per IP per day. */
  freeTurns?: number
  store: PayStore
  /** The 402's error line; the default names the pack and its price. */
  refusal?: (offer: Offer) => string
}

export interface Offer {
  price: string
  priceMicroUsdc: number
  pricePerTurnMicroUsdc: number
  asset: string
  chain: 'mainnet' | 'testnet'
  network: string
  payTo: string
  turnsPerPack: number
  freeTurns: number
}

export type Charge =
  | { ok: true; credits: { paid?: number; freeLeft: number } }
  | { ok: false; response: Response }

export interface Paywall {
  offer: Offer
  credits: Credits
  /** The purchase route: 402 with the requirements, then a verified payment credits the payer. `?turns=N` sizes it. */
  buy: Handler
  /** Takes one turn for this request — today's free ones first, then the bearer token's paid ones — or refuses with a 402. */
  charge(request: Request): Promise<Charge>
  /** The offer plus the caller's balances, for a status endpoint. */
  status(request: Request): Promise<Offer & { freeLeft: number; payer?: string; paid?: number }>
  /** `?turns=N` clamped to 1…maxTurnsPerBuy; the pack when absent. */
  turnsRequested(request: Request): number
}

export const DEFAULT_FACILITATOR_URL = 'https://facilitator.goplausible.xyz'

/** Base units as dollars: 1_000_000 → `$1.00`, 250_000 → `$0.25`. */
export function formatUsdc(microUsdc: number): string {
  return `$${(microUsdc / 10 ** USDC_DECIMALS).toFixed(2)}`
}

export function createPaywall(options: PaywallOptions): Paywall {
  const turnsPerPack = options.turnsPerPack ?? 25
  const maxTurnsPerBuy = options.maxTurnsPerBuy ?? 1000
  // Whole base units per turn, so N turns always cost exactly N times the same figure.
  const pricePerTurnMicroUsdc = Math.max(1, Math.floor((options.priceMicroUsdc ?? 1_000_000) / turnsPerPack))
  const priceMicroUsdc = pricePerTurnMicroUsdc * turnsPerPack
  const asset = options.asset ?? (options.chain === 'mainnet' ? USDC_MAINNET_ASA_ID : USDC_TESTNET_ASA_ID)
  const offer: Offer = {
    price: formatUsdc(priceMicroUsdc),
    priceMicroUsdc,
    pricePerTurnMicroUsdc,
    asset,
    chain: options.chain,
    network: x402Network(options.chain),
    payTo: options.payTo,
    turnsPerPack,
    freeTurns: options.freeTurns ?? 3,
  }
  const credits = createCredits(options.store, { turnsPerPack, freeTurns: offer.freeTurns })
  const refusal = options.refusal ?? ((current: Offer) => `Out of turns — buy a pack (${current.price} → ${current.turnsPerPack} turns).`)

  const turnsRequested = (request: Request) => {
    const n = Number(new URL(request.url).searchParams.get('turns'))
    return !Number.isInteger(n) || n < 1 ? turnsPerPack : Math.min(n, maxTurnsPerBuy)
  }

  const gate = createX402Gate({
    chain: options.chain,
    payTo: options.payTo,
    asset,
    facilitatorUrl: options.facilitatorUrl ?? DEFAULT_FACILITATOR_URL,
    amount: (request) => String(turnsRequested(request) * pricePerTurnMicroUsdc),
    description: `Turns, ${turnsPerPack} by default, up to ${maxTurnsPerBuy}`,
    async onSettled({ payer, amount, request }) {
      await credits.credit(payer, Math.floor(Number(amount) / pricePerTurnMicroUsdc))
      const token = request.headers.get('x-credit-token')
      if (token && TOKEN_PATTERN.test(token)) await credits.bindToken(token, payer)
    },
  })

  return {
    offer,
    credits,
    turnsRequested,
    buy: gate(async (request) => Response.json({ ok: true, turns: turnsRequested(request) })),
    async charge(request) {
      const payer = await credits.payerForToken(bearerOf(request))
      const free = await credits.freeTurn(ipOf(request))
      if (free !== undefined) {
        return { ok: true, credits: { freeLeft: free, ...(payer ? { paid: await credits.balance(payer) } : {}) } }
      }
      const paid = payer ? await credits.spend(payer) : undefined
      if (paid === undefined) {
        return {
          ok: false,
          response: Response.json(
            { error: refusal(offer), offer: { price: offer.price, turns: turnsPerPack } },
            { status: 402 },
          ),
        }
      }
      return { ok: true, credits: { paid, freeLeft: 0 } }
    },
    async status(request) {
      const payer = await credits.payerForToken(bearerOf(request))
      const [paid, freeLeft] = await Promise.all([payer ? credits.balance(payer) : undefined, credits.freeLeft(ipOf(request))])
      return { ...offer, freeLeft, ...(payer ? { payer, paid } : {}) }
    },
  }
}
