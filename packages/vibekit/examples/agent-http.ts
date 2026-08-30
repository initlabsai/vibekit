/**
 * The agent as an HTTP endpoint under Bun: POST a turn, get NDJSON events.
 * The model is a ZeroSignal daemon (zs-proxy) — wallet-admission, no API
 * key; any OpenAI-compatible endpoint is the same one-line change.
 *
 *   bun packages/vibekit/examples/agent-http.ts
 *   curl -N :8790/agent -d '{"network":"testnet","input":"what is asset 10458941?"}'
 */
import { createAgentHandler } from '@initlabs/vibekit/agent'
import { defaultPlugins, defaultTools } from '@initlabs/vibekit/preset'

const agent = createAgentHandler({
  model: { provider: 'zerosignal', model: process.env.AGENT_MODEL ?? 'qwen3:8b' },
  network: 'testnet',
  networks: ['testnet', 'mainnet'],
  mode: 'compose', // actions draft; nothing here can sign
  tools: defaultTools,
  plugins: defaultPlugins(),
  perTurn: { web_search: 3, get_application_program: 2 },
})

const port = Number(process.env.PORT ?? 8790)
Bun.serve({
  port,
  fetch: (request) => (new URL(request.url).pathname === '/agent' ? agent.fetch(request) : Response.json(agent.describe())),
})
console.error(`vibekit agent (http) on :${port}`)
