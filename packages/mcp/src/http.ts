import { createMcpHandler } from '@modelcontextprotocol/server'
import { createServerFactory } from './index.js'
import type { VibekitMcpOptions } from './options.js'

/**
 * Streamable HTTP handler: a fresh stateless server per request.
 *
 * HTTP deployments default to compose mode. Passing mode 'execute' is an
 * explicit self-host opt-in; the deployer must put auth in front.
 */
export function createVibekitHttpHandler(options: VibekitMcpOptions): ReturnType<typeof createMcpHandler> {
  return createMcpHandler(createServerFactory(options))
}
