/**
 * The web Explorer's agent lane: one createAgent per request over the same
 * compose-only deployment the TUI uses, streamed back as NDJSON events. The
 * browser sends the prior turns; nothing is cached. Composed groups leave
 * here as draft records for the write flow's approval modal. Prompts go to
 * Together's API, which is not private; the UI says so.
 */
import { structuredResultSchema, type LiveNetworkId } from '@initlabs/vibekit-explorer'
import {
  activeSenderLine,
  createExplorerAgent,
  draftRecordFromComposeWire,
  networkOfCall,
} from '@initlabs/vibekit-explorer/live'
import { unsignedGroupFromToolResult } from '@initlabs/vibekit-explorer'
import { z } from 'zod'

import { isProduction } from '../explorer/endpoints'

export const runtime = 'nodejs'
export const maxDuration = 60

const TOGETHER_BASE_URL = 'https://api.together.xyz/v1'
const DEFAULT_MODEL = 'Qwen/Qwen2.5-72B-Instruct-Turbo'
const MAX_BODY_BYTES = 256 * 1024
const MAX_HISTORY = 40

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

/** The house-billed caps: per isolate, so they are a floor on abuse, not a ledger. */
const DAILY_CAP = Number(process.env.TOGETHER_DAILY_CAP_TURNS ?? 300)
const IP_HOURLY_CAP = Number(process.env.TOGETHER_IP_HOURLY_CAP ?? 30)
const usage = { day: '', turns: 0, byIp: new Map<string, { hour: number; turns: number }>() }

function chargeTurn(ip: string): string | undefined {
  const now = new Date()
  const day = now.toISOString().slice(0, 10)
  if (usage.day !== day) {
    usage.day = day
    usage.turns = 0
    usage.byIp.clear()
  }
  if (usage.turns >= DAILY_CAP) return 'The house has spent its daily budget on the agent; try again tomorrow.'
  const hour = now.getUTCHours()
  const entry = usage.byIp.get(ip) ?? { hour, turns: 0 }
  if (entry.hour !== hour) Object.assign(entry, { hour, turns: 0 })
  if (entry.turns >= IP_HOURLY_CAP) return 'That is a lot of questions for one hour; try again later.'
  entry.turns += 1
  usage.byIp.set(ip, entry)
  usage.turns += 1
  return undefined
}

function config(): { apiKey: string; model: string } | undefined {
  const apiKey = process.env.TOGETHER_API_KEY
  return apiKey ? { apiKey, model: process.env.TOGETHER_MODEL ?? DEFAULT_MODEL } : undefined
}

/** Whether the lane is on, and which model answers; the composer reads this once. */
export async function GET(): Promise<Response> {
  const together = config()
  return Response.json({
    enabled: together !== undefined,
    ...(together ? { model: together.model, billing: 'house' as const } : {}),
    private: false,
  })
}

export async function POST(request: Request): Promise<Response> {
  const together = config()
  if (!together) return Response.json({ error: 'No agent configured' }, { status: 404 })
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
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  const refused = isProduction() ? chargeTurn(ip) : undefined
  if (refused) return Response.json({ error: refused }, { status: 429 })

  const session = createExplorerAgent({
    model: { provider: 'openai-compatible', baseUrl: TOGETHER_BASE_URL, apiKey: together.apiKey, model: together.model },
    addressBook: body.accounts,
    network: body.network,
    history: body.history as never,
    // A public host pays for nothing expensive on a visitor's say-so.
    approveToolCall: async () => false,
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
