import { Hono } from 'hono'
import {
  streamText,
  stepCountIs,
  convertToModelMessages,
  generateId,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type ToolSet,
} from 'ai'
import { getLLM, getContextWindowSize } from '../lib/llm'
import { createTools } from '../lib/tools'
import { rateLimit, retryAfter } from '../lib/rate-limit'
import { filterTools, buildSystemPrompt } from '../lib/customize'
import { executeFastPath, type FastPathResult } from '../lib/fast-path'
import type { InputHint } from '../lib/input-classifier'

type Env = { Variables: { apiKeyLabel: string } }

const REQUEST_TIMEOUT_MS = 120_000
const MAX_MESSAGES = 50

const allTools = createTools()

export const chatRoute = new Hono<Env>()

chatRoute.post('/', async (c) => {
  const label = c.get('apiKeyLabel')

  const rl = rateLimit(`api:${label}`)
  if (!rl.success) {
    return c.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter(`api:${label}`)) } }
    )
  }

  try {
    const body = await c.req.json()

    if (!body.messages || !Array.isArray(body.messages)) {
      return c.json({ error: 'messages must be an array' }, 400)
    }
    if (body.messages.length > MAX_MESSAGES) {
      return c.json({ error: `Too many messages (max ${MAX_MESSAGES})` }, 400)
    }

    const hint = body.hint as InputHint | undefined
    const tools = filterTools(allTools, body.tools)
    const system = buildSystemPrompt(body.systemPrompt)

    if (hint?.calls?.length) {
      return handleHintPath(tools, hint)
    }
    return handleLLMPath(body, tools, system)
  } catch (err) {
    console.error('[chat]', err instanceof Error ? err.message : String(err))
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/** Fast path: skip LLM, execute hint tool calls and stream results. */
function handleHintPath(tools: ToolSet, hint: InputHint) {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const results = await executeFastPath(hint, tools, REQUEST_TIMEOUT_MS)
      for (const { call, output } of results) {
        const toolCallId = generateId()
        writer.write({
          type: 'tool-input-available',
          toolCallId,
          toolName: call.tool,
          input: call.args,
        })
        writer.write({ type: 'tool-output-available', toolCallId, output })
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

/** LLM path: stream AI response with tools. */
async function handleLLMPath(body: { messages: unknown[] }, tools: ToolSet, system: string) {
  const model = getLLM()
  const contextWindowSize = getContextWindowSize()

  const result = streamText({
    model,
    system,
    messages: await convertToModelMessages(body.messages as any),
    tools,
    stopWhen: stepCountIs(5),
    abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  return result.toUIMessageStreamResponse({
    messageMetadata(event) {
      if (event.part.type === 'finish') {
        const { totalUsage } = event.part
        const inputTokens = totalUsage.inputTokens ?? 0
        const outputTokens = totalUsage.outputTokens ?? 0
        return {
          usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
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
}
