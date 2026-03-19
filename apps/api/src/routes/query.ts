import { Hono } from 'hono'
import type { Context } from 'hono'
import { streamText, generateText, stepCountIs, type ToolSet } from 'ai'
import { classifyInput, buildHint } from '../lib/input-classifier'
import { getLLM, getContextWindowSize } from '../lib/llm'
import { createTools } from '../lib/tools'
import { rateLimit, retryAfter } from '../lib/rate-limit'
import { filterTools, buildSystemPrompt } from '../lib/customize'
import { executeFastPath } from '../lib/fast-path'

type Env = { Variables: { apiKeyLabel: string } }

const REQUEST_TIMEOUT_MS = 120_000
const allTools = createTools()

export const queryRoute = new Hono<Env>()

queryRoute.post('/', async (c) => {
  const label = c.get('apiKeyLabel')

  const rl = rateLimit(`api:${label}`)
  if (!rl.success) {
    return c.json({ error: 'Rate limit exceeded', retryAfter: retryAfter(`api:${label}`) }, 429)
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const query = body.query
  if (!query || typeof query !== 'string') {
    return c.json({ error: 'Missing required field: query' }, 400)
  }

  const tools = filterTools(allTools, body.tools as string[] | undefined)
  const system = buildSystemPrompt(body.systemPrompt as string | undefined)

  const classified = classifyInput(query)
  const hint = buildHint(classified)

  const wantsJson = c.req.header('Accept') === 'application/json'

  if (hint) {
    return await handleFastPath(c, hint, tools, wantsJson)
  }

  if (wantsJson) {
    return await handleLLMJson(c, query, tools, system)
  }
  return await handleLLMStream(c, query, tools, system)
})

async function handleFastPath(
  c: Context<Env>,
  hint: { calls: Array<{ tool: string; args: Record<string, unknown> }>; tryAll?: boolean },
  tools: ToolSet,
  wantsJson: boolean
) {
  const results = await executeFastPath(hint, tools, REQUEST_TIMEOUT_MS)
  const formatted = results.map((r) => ({ tool: r.call.tool, data: r.output }))

  if (wantsJson) {
    return c.json({ text: null, toolResults: formatted, usage: null })
  }

  // NDJSON stream
  const lines: string[] = []
  for (const r of results) {
    lines.push(JSON.stringify({ type: 'tool_call', tool: r.call.tool, args: r.call.args }))
  }
  for (const f of formatted) {
    lines.push(JSON.stringify({ type: 'tool_result', tool: f.tool, data: f.data }))
  }
  lines.push(JSON.stringify({ type: 'done', usage: null }))

  c.header('Content-Type', 'application/x-ndjson')
  return c.body(lines.join('\n') + '\n')
}

async function handleLLMJson(c: Context<Env>, query: string, toolSet: ToolSet, system: string) {
  const result = await generateText({
    model: getLLM(),
    system,
    messages: [{ role: 'user', content: query }],
    tools: toolSet,
    stopWhen: stepCountIs(10),
    maxOutputTokens: getContextWindowSize(),
    abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const toolResults: Array<{ tool: string; data: unknown }> = []
  for (const step of result.steps) {
    for (const tc of step.toolCalls) {
      const tr = step.toolResults.find(
        (r: { toolCallId: string }) => r.toolCallId === tc.toolCallId
      )
      toolResults.push({ tool: tc.toolName, data: tr?.output ?? null })
    }
  }

  return c.json({
    text: result.text || null,
    toolResults,
    usage: result.usage
      ? { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }
      : null,
  })
}

async function handleLLMStream(c: Context<Env>, query: string, toolSet: ToolSet, system: string) {
  const result = streamText({
    model: getLLM(),
    system,
    messages: [{ role: 'user', content: query }],
    tools: toolSet,
    stopWhen: stepCountIs(10),
    maxOutputTokens: getContextWindowSize(),
    abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          let line: string | null = null

          if (part.type === 'tool-call') {
            line = JSON.stringify({ type: 'tool_call', tool: part.toolName, args: part.input })
          } else if (part.type === 'tool-result') {
            line = JSON.stringify({ type: 'tool_result', tool: part.toolName, data: part.output })
          } else if (part.type === 'text-delta') {
            line = JSON.stringify({ type: 'text', content: part.text })
          } else if (part.type === 'finish') {
            line = JSON.stringify({
              type: 'done',
              usage: part.totalUsage
                ? {
                    inputTokens: part.totalUsage.inputTokens,
                    outputTokens: part.totalUsage.outputTokens,
                  }
                : null,
            })
          }

          if (line) controller.enqueue(encoder.encode(line + '\n'))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: msg }) + '\n'))
      } finally {
        controller.close()
      }
    },
  })

  c.header('Content-Type', 'application/x-ndjson')
  return c.body(stream)
}
