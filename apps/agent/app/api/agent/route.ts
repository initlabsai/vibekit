/**
 * The web agent's lane: the package's agent handler, mounted. Everything
 * here is choice, not mechanism — which model (env), which tools (the
 * Explorer's set minus what a chat window has no use for), which prompt
 * (the Explorer's voice), and who pays (the paywall, or the house's caps).
 * Prompts go to the model endpoint, which is not private, and the UI says so.
 */
import { createAgentHandler, type AgentHandler } from '@initlabs/vibekit/agent'
import { haystackPlugin } from '@initlabs/vibekit/plugins/haystack'
import { explorerPlugins, explorerSystemPrompt, explorerTools } from '@initlabs/vibekit/preset'

import { paywall } from '../credits/config'
import { houseRefusal, ipOf } from '../credits/ledger'
import { isProduction } from '../explorer/endpoints'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEFAULT_BASE_URL = 'https://api.together.xyz/v1'
const DEFAULT_MODEL = 'Qwen/Qwen2.5-72B-Instruct-Turbo'
// Not for a chat window: spec-path deploys (no file grant here), the admin writes
// of assets and apps you created, and algod twins of indexer lookups.
const OMITTED_TOOLS = new Set([
  'app_deploy',
  'app_update',
  'app_delete',
  'app_close_out',
  'list_app_spec_methods',
  'asset_freeze',
  'asset_config',
  'asset_destroy',
  'get_asset_info',
  'get_application_info',
  'batch_lookup_accounts',
])
// The house pays for two program pages a turn (a page is ~3k tokens; two explain a contract) and three web calls.
const PER_TURN = { get_application_program: 2, web_search: 3, read_page: 3 }

// txnlab publishes this free-tier key in the SDK README (60 requests a minute, shared by
// everyone who copies it). Fine for a laptop; production sets HAYSTACK_API_KEY to its own.
const HAYSTACK_FREE_TIER_KEY = '1b72df7e-1131-4449-8ce1-29b79dd3f51e'

/**
 * AGENT_API_KEY + AGENT_BASE_URL + AGENT_MODEL name the endpoint; TOGETHER_API_KEY
 * alone still works as the shortest setup. The provider shown to the user is the
 * endpoint's host.
 */
function config(): { apiKey: string; baseUrl: string; model: string; provider: string } | undefined {
  const apiKey = process.env.AGENT_API_KEY ?? process.env.TOGETHER_API_KEY
  if (!apiKey) return undefined
  const baseUrl = process.env.AGENT_BASE_URL ?? DEFAULT_BASE_URL
  const model = process.env.AGENT_MODEL ?? process.env.TOGETHER_MODEL ?? DEFAULT_MODEL
  let provider = baseUrl
  try {
    provider = new URL(baseUrl).hostname.replace(/^api\./, '').replace(/\.(com|ai|xyz)$/, '')
  } catch {
    // an unparsable URL still names itself
  }
  return { apiKey, baseUrl, model, provider }
}

/** House mode bills nothing and rate-limits in production; a paywall bills turns. */
function billing() {
  const wall = paywall()
  if (wall) return wall
  return {
    async charge(request: Request) {
      const refused = isProduction() ? await houseRefusal(ipOf(request)) : undefined
      return refused ? { ok: false as const, response: Response.json({ error: refused }, { status: 429 }) } : { ok: true as const }
    },
  }
}

let built: { key: string; handler: AgentHandler } | undefined
function handler(endpoint: NonNullable<ReturnType<typeof config>>): AgentHandler {
  const key = [endpoint.baseUrl, endpoint.apiKey, endpoint.model, paywall() ? 'x402' : 'house'].join('|')
  if (built?.key !== key) {
    const haystack = haystackPlugin({
      apiKey: process.env.HAYSTACK_API_KEY ?? HAYSTACK_FREE_TIER_KEY,
      ...(process.env.HAYSTACK_REFERRER ? { referrerAddress: process.env.HAYSTACK_REFERRER } : {}),
    })
    built = {
      key,
      handler: createAgentHandler({
        model: { provider: 'openai-compatible', baseUrl: endpoint.baseUrl, apiKey: endpoint.apiKey, model: endpoint.model },
        network: 'localnet',
        // Every network is served: the model passes `network` to leave the active one.
        networks: ['localnet', 'testnet', 'mainnet'],
        mode: 'compose',
        tools: explorerTools(undefined, OMITTED_TOOLS),
        plugins: explorerPlugins(undefined, [haystack]),
        systemPrompt: (turn) => explorerSystemPrompt(turn.tools, turn.network, turn.accounts),
        maxSteps: 8,
        perTurn: PER_TURN,
        billing: billing(),
      }),
    }
  }
  return built.handler
}

/** Whether the lane is on, and which model answers; the composer reads this once. */
export async function GET(): Promise<Response> {
  const endpoint = config()
  return Response.json({
    enabled: endpoint !== undefined,
    ...(endpoint ? { model: endpoint.model, provider: endpoint.provider, billing: paywall() ? ('x402' as const) : ('house' as const) } : {}),
    private: false,
  })
}

export async function POST(request: Request): Promise<Response> {
  const endpoint = config()
  if (!endpoint) return Response.json({ error: 'No agent configured' }, { status: 404 })
  return handler(endpoint).fetch(request)
}
