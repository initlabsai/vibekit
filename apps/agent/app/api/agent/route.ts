/**
 * The web Explorer's agent lane: one createAgent per request over the same
 * compose-only deployment the TUI uses, streamed back as NDJSON events. The
 * browser sends the prior turns; nothing is cached. Composed groups leave
 * here as draft records for the write flow's approval modal. The model is any
 * OpenAI-compatible endpoint (Together, OpenRouter, …) named by env; prompts
 * go there, which is not private, and the UI says so.
 */
import { structuredResultSchema, type LiveNetworkId } from '@initlabs/vibekit-explorer'
import {
  activeSenderLine,
  createExplorerAgent,
  draftRecordFromComposeWire,
  networkOfCall,
} from '@initlabs/vibekit-explorer/live'
import { unsignedGroupFromToolResult } from '@initlabs/vibekit-explorer'
import algosdk from 'algosdk'
import { z } from 'zod'

import { creditsConfig } from '../credits/config'
import { balance, bearerOf, freeTurn, houseTurn, ipOf, payerForToken, spend, TURNS_PER_PACK } from '../credits/ledger'
import { isProduction } from '../explorer/endpoints'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEFAULT_BASE_URL = 'https://api.together.xyz/v1'
const DEFAULT_MODEL = 'Qwen/Qwen2.5-72B-Instruct-Turbo'
const MAX_BODY_BYTES = 256 * 1024
const MAX_HISTORY = 40
const PROGRAM_PAGES_PER_TURN = 2

const requestSchema = z.object({
  network: z.enum(['localnet', 'testnet', 'mainnet']),
  input: z.string().min(1).max(4000),
  /** The wallet's accounts, so the prompt can name a default sender. */
  accounts: z.array(z.object({ address: z.string(), name: z.string().optional() })).max(32).default([]),
  activeAddress: z.string().optional(),
  /** What the Explorer is showing, one line per card, oldest first. */
  context: z.string().max(4000).optional(),
  /** Prior turns as the model saw them; opaque to the browser. */
  history: z.array(z.unknown()).max(MAX_HISTORY).default([]),
})

/** The house-billed caps, kept on the ledger's store so they hold across isolates and cold starts. */
const DAILY_CAP = Number(process.env.AGENT_DAILY_CAP_TURNS ?? 300)
const IP_HOURLY_CAP = Number(process.env.AGENT_IP_HOURLY_CAP ?? 30)

async function chargeTurn(ip: string): Promise<string | undefined> {
  const verdict = await houseTurn(ip, { daily: DAILY_CAP, hourly: IP_HOURLY_CAP })
  if (verdict === 'daily') return "the house is out of turns for today. i'll be here tomorrow."
  if (verdict === 'hourly') return "hmph. that's a lot of questions for one hour. give me a minute — or a few."
  return undefined
}

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

/** Whether the lane is on, and which model answers; the composer reads this once. */
export async function GET(): Promise<Response> {
  const endpoint = config()
  return Response.json({
    enabled: endpoint !== undefined,
    ...(endpoint ? { model: endpoint.model, provider: endpoint.provider, billing: creditsConfig() ? ('x402' as const) : ('house' as const) } : {}),
    private: false,
  })
}

export async function POST(request: Request): Promise<Response> {
  const endpoint = config()
  if (!endpoint) return Response.json({ error: 'No agent configured' }, { status: 404 })
  const text = await request.text()
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return Response.json({ error: 'Request body is too large' }, { status: 413 })
  let parsed
  try {
    parsed = requestSchema.safeParse(JSON.parse(text))
  } catch {
    return Response.json({ error: 'Malformed JSON body' }, { status: 400 })
  }
  if (!parsed.success) return Response.json({ error: 'Invalid agent request' }, { status: 400 })
  const body = parsed.data
  // Paid mode: today's free turns for the IP go first (they expire; paid ones keep), then the
  // bearer token's paid turns, else 402. House mode rate-limits instead. Nothing here trusts a
  // caller-chosen address.
  const pack = creditsConfig()
  let charged: { paid?: number; freeLeft?: number } | undefined
  if (pack) {
    const payer = await payerForToken(bearerOf(request))
    const free = await freeTurn(ipOf(request))
    if (free !== undefined) {
      charged = { freeLeft: free, ...(payer ? { paid: await balance(payer) } : {}) }
    } else {
      const paid = payer && algosdk.isValidAddress(payer) ? await spend(payer) : undefined
      if (paid === undefined) {
        return Response.json(
          { error: `Out of turns — /buy a pack (${pack.price} → ${TURNS_PER_PACK} turns).`, offer: { price: pack.price, turns: TURNS_PER_PACK } },
          { status: 402 },
        )
      }
      charged = { paid, freeLeft: 0 }
    }
  } else {
    const refused = isProduction() ? await chargeTurn(ipOf(request)) : undefined
    if (refused) return Response.json({ error: refused }, { status: 429 })
  }

  // The gate sees every write and expensive call. Writes compose only — the wallet decides —
  // so they always pass. The one expensive tool reads a program a page (~3k tokens) at a
  // time; the house pays for two pages per turn, which explains a contract, and no more.
  let programPages = 0
  const session = createExplorerAgent({
    model: { provider: 'openai-compatible', baseUrl: endpoint.baseUrl, apiKey: endpoint.apiKey, model: endpoint.model },
    addressBook: body.accounts,
    network: body.network,
    history: body.history as never,
    approveToolCall: async ({ toolName }) => toolName !== 'get_application_program' || ++programPages <= PROGRAM_PAGES_PER_TURN,
  })
  const context = [activeSenderLine(body.activeAddress, body.accounts), body.context ?? '']
    .filter(Boolean)
    .join('\n')
  const input = context ? `${context}\n\n${body.input}` : body.input
  const historyLength = body.history.length
  const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      try {
        if (charged) send({ type: 'credits', credits: charged })
        for await (const event of session.stream(input)) {
          if (event.type === 'tool-result') {
            const compose = unsignedGroupFromToolResult(event)
            if (compose) {
              // A composed group is the draft the approval modal reviews; the model never sees signing.
              const draftRecord = draftRecordFromComposeWire(
                { resultId: newId('result-agent-draft'), toolCallId: event.id, network: networkOfCall(event.input, body.network) },
                compose,
                event.toolName,
              )
              send({ type: 'draft', record: structuredResultSchema.parse(draftRecord) })
              continue
            }
          }
          send(event)
        }
        send({ type: 'messages', messages: session.messages.slice(historyLength) })
      } catch (error) {
        send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  })
}
