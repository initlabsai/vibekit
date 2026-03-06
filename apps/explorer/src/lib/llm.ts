import { createOpenAI } from '@ai-sdk/openai'

/** Create an OpenAI-compatible provider from environment variables. */
export function getLLM() {
  const baseURL = process.env.LLM_BASE_URL
  const apiKey = process.env.LLM_API_KEY ?? ''
  const model = process.env.LLM_MODEL ?? 'gpt-4o'

  const provider = createOpenAI({ baseURL, apiKey })
  return provider(model)
}
