/**
 * The deployment behind the REST and MCP routes: every network this host can
 * serve (production needs its own endpoints per network), compose mode, the
 * stock tools and plugins. Signerless by construction. One per isolate.
 */
import { createRestHandler, type RestHandler } from '@initlabs/vibekit/rest'
import { createMcpHttpHandler } from '@initlabs/vibekit/mcp/http'
import { defaultTools } from '@initlabs/vibekit/preset'
import { explorerPlugins } from '@initlabs/vibekit/preset'
import type { NetworkId } from '@initlabs/vibekit'

import { MissingEndpointsError, networkConfigFromEnv, isProduction } from '../explorer/endpoints'
import { paywall } from '../credits/config'
import { houseRefusal, ipOf } from '../credits/ledger'

const NETWORKS = ['mainnet', 'testnet', 'localnet'] as const

function options() {
  const networks = NETWORKS.flatMap((network) => {
    try {
      return [networkConfigFromEnv(network)]
    } catch (error) {
      if (error instanceof MissingEndpointsError) return []
      throw error
    }
  })
  if (networks.length === 0) throw new Error('No network has endpoints configured')
  return { network: networks[0]!, networks, mode: 'compose' as const, tools: defaultTools, plugins: explorerPlugins() }
}

let rest: RestHandler | undefined
export function restHandler(): RestHandler {
  return (rest ??= createRestHandler(options()))
}

let mcp: ReturnType<typeof createMcpHttpHandler> | undefined
export function mcpHandler(): ReturnType<typeof createMcpHttpHandler> {
  return (mcp ??= createMcpHttpHandler({ name: 'vibekit', ...options() }))
}

/** One turn: the paywall's charge when packs are for sale, the house caps in production otherwise. */
export async function chargeTurn(request: Request): Promise<Response | undefined> {
  const wall = paywall()
  if (wall) {
    const charge = await wall.charge(request)
    return charge.ok ? undefined : charge.response
  }
  const refused = isProduction() ? await houseRefusal(ipOf(request)) : undefined
  return refused ? Response.json({ error: refused }, { status: 429 }) : undefined
}

export type { NetworkId }
