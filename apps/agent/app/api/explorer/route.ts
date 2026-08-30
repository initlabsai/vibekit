/**
 * The browser's action steps and its liveness probe. POST is the package's
 * action routes over one signerless live host per network: draft, simulate,
 * record a wallet's signature, submit, confirmation — every signed byte is
 * verified against the approved draft before anything is recorded or
 * broadcast. Reads go to `./[name]` (the query handler, house-billed). GET
 * answers "is this network reachable, and what round is it on".
 */
import { createActionRoutes } from '@initlabs/vibekit/actions'
import { createLiveHost, type LiveHost, type LiveNetworkId } from '@initlabs/vibekit/live'
import { z } from 'zod'

import { MissingEndpointsError, networkConfigFromEnv } from './endpoints'

export const runtime = 'nodejs'
export const maxDuration = 15

const networkSchema = z.enum(['localnet', 'testnet', 'mainnet'])

/**
 * Cache only signerless createLiveHost(network) with the stock tool list.
 * Do not put request- or user-scoped options on a cached host. Serverless
 * isolates each have their own Map.
 */
const hosts = new Map<LiveNetworkId, LiveHost>()
function hostFor(network: string): LiveHost {
  const parsed = networkSchema.safeParse(network)
  if (!parsed.success) throw new UnknownNetworkError(network)
  let host = hosts.get(parsed.data)
  if (!host) {
    host = createLiveHost(networkConfigFromEnv(parsed.data))
    hosts.set(parsed.data, host)
  }
  return host
}
class UnknownNetworkError extends Error {
  constructor(network: string) {
    super(`Unknown network: ${network}`)
  }
}

export async function GET(request: Request): Promise<Response> {
  const parsed = networkSchema.safeParse(new URL(request.url).searchParams.get('network') ?? 'mainnet')
  if (!parsed.success) return Response.json({ error: 'Unknown network' }, { status: 400 })
  try {
    const host = hostFor(parsed.data)
    // One status call answers both questions; the probe's timeout still bounds it.
    const status = await Promise.race([host.statusRound(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))]).catch(() => null)
    return Response.json(status ? { network: parsed.data, live: true, round: status.lastRound } : { network: parsed.data, live: false })
  } catch (error) {
    if (error instanceof MissingEndpointsError) return Response.json({ error: error.message }, { status: 503 })
    return Response.json({ network: parsed.data, live: false })
  }
}

export const POST = createActionRoutes({
  hostFor,
  errorStatus: (error) => (error instanceof MissingEndpointsError ? 503 : error instanceof UnknownNetworkError ? 400 : undefined),
})
