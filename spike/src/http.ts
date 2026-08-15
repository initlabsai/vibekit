/** Streamable HTTP entry: stateless per-request servers, compose mode (no server-side signer over HTTP — V2-DESIGN §5). */
import { createMcpHandler } from '@modelcontextprotocol/server'
import { createSpikeMcp } from './server'
import { spikeTools } from './tools'
import type { NetworkId } from './contract'

const handler = createMcpHandler((_req) =>
  createSpikeMcp({
    network: (process.env.NETWORK ?? 'testnet') as NetworkId,
    mode: 'compose',
    tools: spikeTools,
  }),
)

const port = Number(process.env.PORT ?? 8788)
Bun.serve({ port, fetch: (req) => handler.fetch(req) })
console.error(`vibekit-spike http: listening on :${port} (compose mode)`)
