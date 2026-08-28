/**
 * The credit pack: one x402 payment in USDC buys AGENT_TURNS_PER_PACK turns
 * for the paying address. The hosted facilitator verifies and settles; the
 * ledger credits the payer it reports. GET reads a balance.
 */
import { ExactAvmScheme } from '@x402/avm/exact/server'
import { HTTPFacilitatorClient } from '@x402/core/server'
import { withX402, x402ResourceServer } from '@x402/next'
import algosdk from 'algosdk'
import { NextResponse, type NextRequest } from 'next/server'

import { creditsConfig, FACILITATOR_URL } from './config'
import { balance, credit, FREE_TURNS, TURNS_PER_PACK } from './ledger'

export const runtime = 'nodejs'

type Handler = (request: NextRequest) => Promise<NextResponse>
let paid: Handler | undefined

/** Built once per isolate: the resource server that turns a settled payment into credit. */
function paidRoute(): Handler | undefined {
  if (paid) return paid
  const config = creditsConfig()
  if (!config) return undefined
  const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: FACILITATOR_URL })).register(config.network, new ExactAvmScheme())
  server.onAfterSettle(async ({ result }) => {
    if (result.success && result.payer) await credit(result.payer)
  })
  paid = withX402(
    async () => NextResponse.json({ ok: true, turns: TURNS_PER_PACK }),
    {
      // An atomic amount, not a money string: nothing between the env and the requirement rounds.
      accepts: { scheme: 'exact', network: config.network, payTo: config.payTo, price: { asset: config.asset, amount: String(config.priceMicroUsdc) } },
      description: `${TURNS_PER_PACK} VibeKit Agent turns`,
    },
    server,
  )
  return paid
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = creditsConfig()
  const payer = request.nextUrl.searchParams.get('payer')
  const credits = payer && algosdk.isValidAddress(payer) ? await balance(payer) : undefined
  return NextResponse.json({
    enabled: config !== undefined,
    ...(config ? { price: config.price, priceMicroUsdc: config.priceMicroUsdc, asset: config.asset, chain: config.chain, network: config.network, payTo: config.payTo } : {}),
    turnsPerPack: TURNS_PER_PACK,
    freeTurns: FREE_TURNS,
    ...(credits ? { credits } : {}),
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const route = paidRoute()
  if (!route) return NextResponse.json({ error: 'Credits are not for sale here; the house pays.' }, { status: 404 })
  return route(request)
}
