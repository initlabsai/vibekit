/**
 * The agent as an HTTP handler: one turn per POST, streamed back as NDJSON
 * events. Web-standard Request/Response, so it mounts in Next, Bun, Hono,
 * or Workers unchanged. Every knob is an option — the model, the tools, the
 * billing, the caps — and nothing here reads the environment.
 *
 * A composed group leaves as a `draft` record for an approval screen; the
 * model never sees signing. The caller sends the prior turns back each time
 * (`history`); the handler holds nothing between requests.
 */
import { z } from 'zod'

import { composeWireResultSchema, draftRecordFromComposeWire } from '../actions/index.js'
import { jsonSafe, type AnyTool, type DeploymentOptions } from '../core/index.js'
import { createAgent, type AgentSession, type VibekitAgentOptions } from './agent.js'
import { activeSenderLine } from './context.js'

export interface AgentAccount {
  address: string
  name?: string
}

/** What the handler can be told about the turn's context, by whoever calls `systemPrompt`. */
export interface AgentTurn {
  network: string
  accounts: readonly AgentAccount[]
  /** Every tool the model can call this turn, plugins included. */
  tools: readonly AnyTool[]
}

/** A billing decision for one turn: run it (with balances to report), or answer with this response instead. */
export type AgentBilling = {
  charge(request: Request): Promise<{ ok: true; credits?: unknown } | { ok: false; response: Response }>
}

export interface AgentHandlerOptions extends DeploymentOptions {
  model: VibekitAgentOptions['model']
  /** A string, or a function of the turn. Default: the built-in prompt. */
  systemPrompt?: string | ((turn: AgentTurn) => string)
  extraInstructions?: string
  maxSteps?: number
  /** Per-turn caps by tool name: `{ web_search: 3, get_application_program: 2 }`. Gated tools without a cap always pass. */
  perTurn?: Record<string, number>
  /** A paywall's `charge`, or anything shaped like it. Absent: every turn runs. */
  billing?: AgentBilling
  limits?: { bodyBytes?: number; historyTurns?: number; inputChars?: number }
  /** Test seam: replaces createAgent. */
  createSession?: (options: VibekitAgentOptions) => AgentSession
}

const bodySchema = (limits: { historyTurns: number; inputChars: number }) =>
  z.object({
    network: z.string().min(1).optional(),
    input: z.string().min(1).max(limits.inputChars),
    /** The caller's accounts, so the prompt can name a default sender. */
    accounts: z.array(z.object({ address: z.string(), name: z.string().optional() })).max(32).default([]),
    activeAddress: z.string().optional(),
    /** What the caller is showing, one line per item, oldest first. */
    context: z.string().max(limits.inputChars).optional(),
    /** Prior turns as the model saw them; opaque to the caller. */
    history: z.array(z.unknown()).max(limits.historyTurns).default([]),
  })

export type AgentTurnBody = z.infer<ReturnType<typeof bodySchema>>

export interface AgentHandler {
  fetch(request: Request): Promise<Response>
  /** The networks served and the tools registered, for a status endpoint. */
  describe(): { networks: string[]; tools: string[] }
}

export function createAgentHandler(options: AgentHandlerOptions): AgentHandler {
  const limits = { bodyBytes: 256 * 1024, historyTurns: 40, inputChars: 4000, ...options.limits }
  const schema = bodySchema(limits)
  const configs = new Map([options.network, ...(options.networks ?? [])].map((n) => [typeof n === 'string' ? n : n.id, n] as const))
  const networkIds = [...configs.keys()]
  const allTools = [...(options.tools ?? []), ...(options.plugins ?? []).flatMap((plugin) => plugin.tools)]
  const createSession = options.createSession ?? createAgent
  const {
    model, systemPrompt, extraInstructions, maxSteps, perTurn, billing,
    limits: _limits, createSession: _createSession, ...deployment
  } = options

  return {
    describe: () => ({ networks: networkIds, tools: allTools.map((tool) => tool.name) }),
    async fetch(request) {
      if (request.method !== 'POST') return Response.json({ error: 'POST a turn' }, { status: 405 })
      const text = await request.text()
      if (new TextEncoder().encode(text).byteLength > limits.bodyBytes) {
        return Response.json({ error: 'Request body is too large' }, { status: 413 })
      }
      let parsed
      try {
        parsed = schema.safeParse(JSON.parse(text))
      } catch {
        return Response.json({ error: 'Malformed JSON body' }, { status: 400 })
      }
      if (!parsed.success) return Response.json({ error: 'Invalid agent request' }, { status: 400 })
      const body = parsed.data
      const network = body.network ?? networkIds[0]!
      if (!networkIds.includes(network)) return Response.json({ error: `Network not served: ${network}` }, { status: 400 })

      let credits: unknown
      if (billing) {
        const charge = await billing.charge(request)
        if (!charge.ok) return charge.response
        credits = charge.credits
      }

      const counts = new Map<string, number>()
      const turn: AgentTurn = { network, accounts: body.accounts, tools: allTools }
      const session = createSession({
        ...deployment,
        network: configs.get(network)!,
        model,
        ...(systemPrompt ? { systemPrompt: typeof systemPrompt === 'string' ? systemPrompt : systemPrompt(turn) } : {}),
        ...(extraInstructions ? { extraInstructions } : {}),
        ...(maxSteps ? { maxSteps } : {}),
        history: body.history as VibekitAgentOptions['history'],
        // Writes compose only — the wallet decides — so they always pass; only capped tools are counted.
        approveToolCall: async ({ toolName }) => {
          const cap = perTurn?.[toolName]
          if (cap === undefined) return true
          const used = (counts.get(toolName) ?? 0) + 1
          counts.set(toolName, used)
          return used <= cap
        },
      })
      const prelude = [activeSenderLine(body.activeAddress, body.accounts), body.context ?? ''].filter(Boolean).join('\n')
      const input = prelude ? `${prelude}\n\n${body.input}` : body.input
      const historyLength = body.history.length
      const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(jsonSafe(event))}\n`))
          try {
            if (credits !== undefined) send({ type: 'credits', credits })
            for await (const event of session.stream(input)) {
              if (event.type === 'tool-result' && !event.isError) {
                const compose = composeWireResultSchema.safeParse(event.output)
                if (compose.success) {
                  const requested = (event.input as { network?: unknown } | undefined)?.network
                  const record = draftRecordFromComposeWire(
                    {
                      resultId: newId('result-agent-draft'),
                      toolCallId: event.id,
                      network: typeof requested === 'string' && networkIds.includes(requested) ? requested : network,
                    },
                    compose.data,
                    event.toolName,
                  )
                  send({ type: 'draft', record })
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
    },
  }
}
