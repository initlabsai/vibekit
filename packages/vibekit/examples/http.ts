/** The reference HTTP deployment: stateless, compose-mode, one fresh server per request. */
import { createMcpHttpHandler } from '@initlabs/vibekit/mcp/http'
import type { NetworkId } from '@initlabs/vibekit'
import { defaultTools } from '@initlabs/vibekit/preset'

const handler = createMcpHttpHandler({
  name: 'vibekit-reference',
  network: (process.env.NETWORK as NetworkId) ?? 'testnet',
  mode: 'compose', // never 'execute' over HTTP without auth in front
  tools: defaultTools,
})

const port = Number(process.env.PORT ?? 8788)
Bun.serve({ port, fetch: (request) => handler.fetch(request) })
console.error(`vibekit mcp (http) on :${port}`)
