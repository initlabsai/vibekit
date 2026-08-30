/**
 * The reference server: the toolkit, mounted. One agent endpoint, the
 * action routes a browser needs (draft, simulate, verify a signature,
 * submit), REST over every tool, and the built page. Nothing here can sign.
 *
 *   bun run build && bun server.ts          # http://localhost:8790
 *   AGENT_BASE_URL=… AGENT_API_KEY=… AGENT_MODEL=… for a hosted model; default is a local ZeroSignal daemon.
 */
import { createActionRoutes } from '@initlabs/vibekit/actions'
import { createAgentHandler } from '@initlabs/vibekit/agent'
import { createHost, defaultPlugins, defaultTools, type Host } from '@initlabs/vibekit/preset'
import { createRestHandler } from '@initlabs/vibekit/rest'
import { join } from 'node:path'

const NETWORKS = ['testnet', 'mainnet'] as const
const model = process.env.AGENT_BASE_URL
  ? { provider: 'openai-compatible' as const, baseUrl: process.env.AGENT_BASE_URL, apiKey: process.env.AGENT_API_KEY, model: process.env.AGENT_MODEL ?? 'gpt-5' }
  : { provider: 'zerosignal' as const, model: process.env.AGENT_MODEL ?? 'qwen3:8b' }

const agent = createAgentHandler({ model, network: 'testnet', networks: [...NETWORKS], mode: 'compose', tools: defaultTools, plugins: defaultPlugins(), perTurn: { web_search: 3 } })
const rest = createRestHandler({ network: 'testnet', networks: [...NETWORKS], mode: 'compose', tools: defaultTools, plugins: defaultPlugins() })
const hosts = new Map<string, Host>()
const actions = createActionRoutes({
  hostFor: (network) => {
    if (!(NETWORKS as readonly string[]).includes(network)) throw new Error(`Unknown network: ${network}`)
    return hosts.get(network) ?? hosts.set(network, createHost(network as (typeof NETWORKS)[number])).get(network)!
  },
  errorStatus: (error) => (error instanceof Error && error.message.startsWith('Unknown network') ? 400 : undefined),
})

const dist = join(import.meta.dir, 'dist')
Bun.serve({
  port: Number(process.env.PORT ?? 8790),
  async fetch(request) {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/agent') return agent.fetch(request)
    if (pathname === '/api/actions') return actions(request)
    if (pathname === '/api/tools') return Response.json({ tools: rest.catalogue() })
    const tool = pathname.match(/^\/api\/tools\/([a-z0-9_]+)$/)?.[1]
    if (tool) return rest.call(tool, request)
    const file = Bun.file(join(dist, pathname === '/' ? 'index.html' : pathname))
    return (await file.exists()) ? new Response(file) : new Response(Bun.file(join(dist, 'index.html')))
  },
})
console.error(`vibekit reference agent on :${process.env.PORT ?? 8790} (${model.provider})`)
