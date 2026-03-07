import type { LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createTogetherAI } from '@ai-sdk/togetherai'
import { env } from '@/lib/env'

/**
 * Create an LLM provider based on environment config.
 * Uses @ai-sdk/togetherai for Together AI (required for proper tool calling),
 * falls back to @ai-sdk/openai for OpenAI-compatible APIs like Ollama.
 */
export function getLLM(): LanguageModel {
  if (env.LLM_BASE_URL.includes('together')) {
    const provider = createTogetherAI({ apiKey: env.LLM_API_KEY })
    return provider(env.LLM_MODEL)
  }

  const provider = createOpenAI({ baseURL: env.LLM_BASE_URL, apiKey: env.LLM_API_KEY })
  return provider(env.LLM_MODEL)
}
