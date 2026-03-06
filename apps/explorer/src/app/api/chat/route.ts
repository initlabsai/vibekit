import { streamText } from 'ai'
import { getLLM } from '@/lib/llm'
import { createExplorerTools } from '@/lib/tools'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'

const REQUEST_TIMEOUT_MS = 60_000

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    const model = getLLM()
    const tools = createExplorerTools()

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages,
      tools,
      maxSteps: 5,
      abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    return result.toDataStreamResponse()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[chat]', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
