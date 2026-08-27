/**
 * BYOM provider resolution. Config in, AI SDK LanguageModel out —
 * hosts can also pass a LanguageModel instance directly (custom providers,
 * middleware, mocks in tests).
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

import { zeroSignalBaseUrl } from './zerosignal.js'

export interface ProviderConfig {
  /**
   * 'ollama' is sugar for openai-compatible with baseUrl
   * http://localhost:11434/v1; 'zerosignal' for the zs-proxy daemon at
   * http://localhost:8080/v1 (wallet-admission — no API key; the model id
   * must come from its live /v1/models catalog).
   */
  provider: 'anthropic' | 'openai' | 'openai-compatible' | 'ollama' | 'zerosignal'
  /** Model id, e.g. 'claude-sonnet-5', 'gpt-5', 'qwen3:8b'. */
  model: string
  /** Falls back to the provider's conventional env var (ANTHROPIC_API_KEY, OPENAI_API_KEY). */
  apiKey?: string
  baseUrl?: string
}

export function isProviderConfig(value: unknown): value is ProviderConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'provider' in value &&
    'model' in value &&
    typeof (value as ProviderConfig).model === 'string'
  )
}

export function createModel(config: ProviderConfig): LanguageModel {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropic({
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      })(config.model)
    case 'openai':
      return createOpenAI({
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      })(config.model)
    case 'ollama':
      return createOpenAICompatible({
        name: 'ollama',
        baseURL: config.baseUrl ?? 'http://localhost:11434/v1',
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      })(config.model)
    case 'zerosignal':
      // The proxy ignores the key (admission is the wallet's on-chain
      // seal); a non-empty value only satisfies SDK plumbing.
      return createOpenAICompatible({
        name: 'zerosignal',
        baseURL: config.baseUrl ?? zeroSignalBaseUrl(),
        apiKey: config.apiKey ?? 'zerosignal',
      })(config.model)
    case 'openai-compatible': {
      if (!config.baseUrl) {
        throw new Error("provider 'openai-compatible' requires baseUrl")
      }
      return createOpenAICompatible({
        name: 'openai-compatible',
        baseURL: config.baseUrl,
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      })(config.model)
    }
  }
}
