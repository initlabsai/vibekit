/** Validated environment variables. Throws at import time if required vars are missing. */

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
  LLM_BASE_URL: requireUrl('LLM_BASE_URL'),
  LLM_API_KEY: requireEnv('LLM_API_KEY'),
  LLM_MODEL: process.env.LLM_MODEL ?? 'gpt-4o',
  ALGORAND_NETWORK: process.env.ALGORAND_NETWORK ?? 'mainnet',
}
