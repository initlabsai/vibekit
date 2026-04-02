/** Validated environment variables. Validates lazily on first access to avoid build-time errors. */

import { ALGOD_PRESETS } from '@vibekit/core'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function requireUrl(name: string): string {
  const value = requireEnv(name)
  try {
    new URL(value)
  } catch {
    throw new Error(`${name} must be a valid URL, got: ${value}`)
  }
  return value
}

export const env = {
  get LLM_BASE_URL() {
    return requireUrl('LLM_BASE_URL')
  },
  get LLM_API_KEY() {
    return requireEnv('LLM_API_KEY')
  },
  get LLM_MODEL() {
    return process.env.LLM_MODEL ?? 'gpt-4o'
  },
  get API_KEYS() {
    return process.env.API_KEYS ?? ''
  },
  get PORT() {
    return Number(process.env.PORT) || 3001
  },
  get UPSTASH_REDIS_REST_URL() {
    return process.env.UPSTASH_REDIS_REST_URL
  },
  get UPSTASH_REDIS_REST_TOKEN() {
    return process.env.UPSTASH_REDIS_REST_TOKEN
  },
  get ALGORAND_NETWORK() {
    return process.env.ALGORAND_NETWORK ?? 'mainnet'
  },
  get ALGORAND_ALGOD_URL() {
    if (process.env.ALGORAND_ALGOD_URL) return process.env.ALGORAND_ALGOD_URL
    const preset = ALGOD_PRESETS[this.ALGORAND_NETWORK] ?? ALGOD_PRESETS.mainnet
    return preset.url
  },
}
