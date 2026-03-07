/** Validated environment variables. Validates lazily on first access to avoid build-time errors. */

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
  get LLM_BASE_URL() { return requireUrl('LLM_BASE_URL') },
  get LLM_API_KEY() { return requireEnv('LLM_API_KEY') },
  get LLM_MODEL() { return process.env.LLM_MODEL ?? 'gpt-4o' },
  get ALGORAND_NETWORK() { return process.env.ALGORAND_NETWORK ?? 'mainnet' },
}
