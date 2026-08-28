/**
 * The credit pack: one x402 payment in USDC buys AGENT_TURNS_PER_PACK turns
 * for the paying address. The hosted facilitator verifies and settles; the
 * ledger credits the payer it reports and binds the `x-credit-token` the
 * buyer sent with the payment — the only request whose author is proven.
 * GET reads the offer, the bearer's balance, and today's free turns.
 */
import { ExactAvmScheme } from '@x402/avm/exact/server'
import { HTTPFacilitatorClient } from '@x402/core/server'
import { withX402, x402ResourceServer } from '@x402/next'
import algosdk from 'algosdk'
import { NextResponse, type NextRequest } from 'next/server'

import { creditsConfig, FACILITATOR_URL, MAX_TURNS_PER_BUY, turnsRequested } from './config'
import { balance, bearerOf, bindToken, credit, freeLeft, FREE_TURNS, ipOf, payerForToken, TOKEN_PATTERN, TURNS_PER_PACK } from './ledger'

export const runtime = 'nodejs'
// The paid retry waits for the facilitator to verify, submit, and see the transfer confirmed
// before it can credit anyone; the platform default (10s) is not enough for that.
export const maxDuration = 60

type HeaderSource = { getHeader(name: string): string | undefined }

/**
 * The `x-credit-token` on the request that paid. The Next adapter arrives
 * wrapped as `{ request: { adapter } }` at settle time; accept it bare too.
 */
export function creditTokenOf(transportContext: unknown): string | undefined {
  const context = transportContext as { adapter?: HeaderSource; request?: { adapter?: HeaderSource } } | undefined
  const adapter = context?.request?.adapter ?? context?.adapter
  const token = adapter?.getHeader('x-credit-token')
  return token && TOKEN_PATTERN.test(token) ? token : undefined
}

type Handler = (request: NextRequest) => Promise<NextResponse>
let paid: Handler | undefined

/** Built once per isolate: the resource server that turns a settled payment into credit. */
function paidRoute(): Handler | undefined {
  if (paid) return paid
  const config = creditsConfig()
  if (!config) return undefined
  const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: FACILITATOR_URL })).register(config.network, new ExactAvmScheme())
  server.onAfterSettle(async ({ result, requirements, transportContext }) => {
    if (!result.success || !result.payer) return
    // Turns follow the amount actually required and settled, never a number the caller sent separately.
    await credit(result.payer, Math.floor(Number(requirements.amount) / config.pricePerTurnMicroUsdc))
    const token = creditTokenOf(transportContext)
    if (token) await bindToken(token, result.payer)
  })
  paid = withX402(
    async (request) => NextResponse.json({ ok: true, turns: turnsRequested(request.nextUrl.searchParams.get('turns')) }),
    {
      // An atomic amount, not a money string, sized by `?turns=`: nothing between the env and the requirement rounds.
      accepts: {
        scheme: 'exact',
        network: config.network,
        payTo: config.payTo,
        price: (context) => ({ asset: config.asset, amount: String(turnsRequested(context.adapter.getQueryParam?.('turns')) * config.pricePerTurnMicroUsdc) }),
      },
      description: `VibeKit Agent turns, ${TURNS_PER_PACK} by default, up to ${MAX_TURNS_PER_BUY}`,
    },
    server,
  )
  return paid
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = creditsConfig()
  const payer = await payerForToken(bearerOf(request))
  const [paid, free] = await Promise.all([payer ? balance(payer) : Promise.resolve(undefined), freeLeft(ipOf(request))])
  return NextResponse.json({
    enabled: config !== undefined,
    ...(config ? { price: config.price, priceMicroUsdc: config.priceMicroUsdc, pricePerTurnMicroUsdc: config.pricePerTurnMicroUsdc, asset: config.asset, chain: config.chain, network: config.network, payTo: config.payTo } : {}),
    turnsPerPack: TURNS_PER_PACK,
    freeTurns: FREE_TURNS,
    freeLeft: free,
    ...(payer && algosdk.isValidAddress(payer) ? { payer, paid } : {}),
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const route = paidRoute()
  if (!route) return NextResponse.json({ error: 'Credits are not for sale here; the house pays.' }, { status: 404 })
  return route(request)
}
