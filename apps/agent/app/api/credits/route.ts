/**
 * The credit pack: one x402 payment in USDC buys turns for the paying address
 * (POST, `?turns=N`); GET reads the offer, the bearer's balance, and today's
 * free turns. The rule is the package's paywall; this route only mounts it.
 */
import { paywall } from './config'
import { freeLeft, FREE_TURNS, ipOf, TURNS_PER_PACK } from './ledger'

export const runtime = 'nodejs'
// The paid retry waits for the facilitator to verify, submit, and see the transfer confirmed
// before it can credit anyone; the platform default (10s) is not enough for that.
export const maxDuration = 60

export async function GET(request: Request): Promise<Response> {
  const wall = paywall()
  if (!wall) {
    return Response.json({ enabled: false, turnsPerPack: TURNS_PER_PACK, freeTurns: FREE_TURNS, freeLeft: await freeLeft(ipOf(request)) })
  }
  return Response.json({ enabled: true, ...(await wall.status(request)) })
}

export async function POST(request: Request): Promise<Response> {
  const wall = paywall()
  if (!wall) return Response.json({ error: 'Credits are not for sale here; the house pays.' }, { status: 404 })
  return wall.buy(request)
}
