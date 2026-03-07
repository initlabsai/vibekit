import { streamText, stepCountIs } from 'ai';
import { getLLM } from '@/lib/llm'
import { createExplorerTools } from '@/lib/tools'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { rateLimit, retryAfter } from '@/lib/rate-limit'

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

    const model = getLLM()
    const tools = createExplorerTools()

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: body.messages,
      tools,
      stopWhen: stepCountIs(5),
      abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[chat:stream]', message)
        return message
      },
    });
  } catch (err) {
    console.error('[chat]', err instanceof Error ? err.message : String(err))
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
