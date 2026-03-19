import type { LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createTogetherAI } from '@ai-sdk/togetherai'
import { env } from './env'

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'Qwen/Qwen3-235B-A22B-Instruct-2507-tput': 262_144,
}

const DEFAULT_CONTEXT_WINDOW = 128_000

export function getContextWindowSize(): number {
  return MODEL_CONTEXT_WINDOWS[env.LLM_MODEL] ?? DEFAULT_CONTEXT_WINDOW
}

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
  return provider.chat(env.LLM_MODEL)
}
