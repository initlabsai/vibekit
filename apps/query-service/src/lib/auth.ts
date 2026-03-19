import { env } from './env'

export interface ApiKeyInfo {
  label: string
}

/** Parse API_KEYS env var into a map of key → label. */
function getApiKeys(): Map<string, string> {
  const raw = env.API_KEYS
  const keys = new Map<string, string>()
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim()
    if (!trimmed) continue
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue
    const label = trimmed.slice(0, colonIdx)
    const key = trimmed.slice(colonIdx + 1)
    if (label && key) keys.set(key, label)
  }
  return keys
}

/** Validate a bearer token from the Authorization header. Returns key info or null. */
export function validateApiKey(authHeader: string | null): ApiKeyInfo | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  if (!token) return null

  const keys = getApiKeys()
  const label = keys.get(token)
  if (!label) return null

  return { label }
}
