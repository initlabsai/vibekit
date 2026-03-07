import { createOpenAI } from '@ai-sdk/openai'
import { env } from '@/lib/env'

/** Create an OpenAI-compatible provider from validated environment variables. */
export function getLLM() {
  const provider = createOpenAI({ baseURL: env.LLM_BASE_URL, apiKey: env.LLM_API_KEY })
  return provider(env.LLM_MODEL)
}
