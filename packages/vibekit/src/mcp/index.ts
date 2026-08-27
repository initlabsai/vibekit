import { McpServer } from '@modelcontextprotocol/server'
import { registerTools } from './adapter.js'
import { resolveDeployment, type VibekitMcpOptions } from './options.js'

export { VIEW_META_KEY, NETWORK_PARAM } from './adapter.js'
export type { VibekitMcpOptions } from './options.js'

/**
 * Build one stateless McpServer from tools + plugins. Registry validation
 * happens once (throws at startup on duplicates / missing signer).
 *
 * Transports live in subpath exports so the core stays runtime-neutral:
 * `@initlabs/vibekit/mcp/stdio` and `@initlabs/vibekit/mcp/http`.
 */
export function createVibekitMcp(options: VibekitMcpOptions): McpServer {
  const deployment = resolveDeployment(options)
  const server = new McpServer({ name: deployment.name, version: deployment.version })
  registerTools(server, deployment)
  return server
}

/**
 * A validated factory: options are checked eagerly (fail at startup), then each
 * call builds a fresh server — the shape both serveStdio and createMcpHandler want.
 */
export function createServerFactory(options: VibekitMcpOptions): () => McpServer {
  resolveDeployment(options)
  return () => createVibekitMcp(options)
}
