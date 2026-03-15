import {
  streamText,
  stepCountIs,
  convertToModelMessages,
  generateId,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai'
import { getLLM, getContextWindowSize } from '@/lib/llm'
import { createExplorerTools } from '@/lib/tools'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { rateLimit, retryAfter } from '@/lib/rate-limit'
import type { InputHint } from '@/lib/input-classifier'

export const maxDuration = 300

const REQUEST_TIMEOUT_MS = 120_000
const MAX_MESSAGES = 50

export async function POST(req: Request) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const limit = rateLimit(ip)
  if (!limit.success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter(ip)),
      },
    })
  }

  try {
    const body = await req.json()

    // Input validation
    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: 'messages must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (body.messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: `Too many messages (max ${MAX_MESSAGES})` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const hint = body.hint as InputHint | undefined
    const tools = createExplorerTools()

    // Fast path: skip LLM entirely when hint is present
    if (hint?.calls?.length) {
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          let calls = hint.calls

          if (hint.tryAll) {
            // Run all calls in parallel, only emit results for ones that succeed
            const results = await Promise.allSettled(
              calls
                .filter((c) => tools[c.tool])
                .map(async (call) => {
                  const output = await tools[call.tool].execute!(call.args, {
                    toolCallId: generateId(),
                    messages: [],
                    abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                  })
                  const isError =
                    output &&
                    typeof output === 'object' &&
                    'error' in (output as Record<string, unknown>)
                  return { call, output, isError }
                })
            )

            for (const r of results) {
              if (r.status !== 'fulfilled' || r.value.isError) continue
              const { call, output } = r.value
              const toolCallId = generateId()
              writer.write({
                type: 'tool-input-available',
                toolCallId,
                toolName: call.tool,
                input: call.args,
              })
              writer.write({ type: 'tool-output-available', toolCallId, output })
            }
          } else {
            // Sequential execution with chaining support (e.g. NFD → account)
            for (const call of calls) {
              const toolCallId = generateId()
              const toolFn = tools[call.tool]
              if (!toolFn) continue

              writer.write({
                type: 'tool-input-available',
                toolCallId,
                toolName: call.tool,
                input: call.args,
              })

              const output = await toolFn.execute!(call.args, {
                toolCallId,
                messages: [],
                abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
              })

              writer.write({ type: 'tool-output-available', toolCallId, output })

              // NFD special case: chain to address lookups after resolution
              if (
                call.tool === 'resolve_nfd' &&
                output &&
                typeof output === 'object' &&
                'address' in (output as Record<string, unknown>)
              ) {
                const address = (output as Record<string, unknown>).address as string
                if (address) {
                  calls = [...calls, { tool: 'lookup_account', args: { address } }]
                }
              }
            }
          }
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'Unknown error'
          console.error('[chat:hint]', message)
          return message
        },
      })

      return createUIMessageStreamResponse({ stream })
    }

    const model = getLLM()

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(body.messages),
      tools,
      stopWhen: stepCountIs(5),
      abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    const contextWindowSize = getContextWindowSize()

    return result.toUIMessageStreamResponse({
      messageMetadata(event) {
        if (event.part.type === 'finish') {
          const { totalUsage } = event.part
          const inputTokens = totalUsage.inputTokens ?? 0
          const outputTokens = totalUsage.outputTokens ?? 0
          return {
            usage: {
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
            },
            contextWindowSize,
          }
        }
        return undefined
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[chat:stream]', message)
        return message
      },
    })
  } catch (err) {
    console.error('[chat]', err instanceof Error ? err.message : String(err))
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
