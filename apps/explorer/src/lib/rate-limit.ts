/** Sliding-window in-memory rate limiter. Resets on cold starts (acceptable for alpha). */

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
}

const store = new Map<string, RateLimitEntry>()

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000
const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 10

/** Prune entries whose window has expired. */
function prune() {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key)
  }
}

/** Check and consume one request for the given IP. */
export function rateLimit(ip: string): RateLimitResult {
  // Prune occasionally to avoid unbounded growth
  if (store.size > 1000) prune()

  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || now >= entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: maxRequests - 1 }
  }

  entry.count++
  if (entry.count > maxRequests) {
    return { success: false, remaining: 0 }
  }

  return { success: true, remaining: maxRequests - entry.count }
}

/** Seconds until the current window resets for the given IP. */
export function retryAfter(ip: string): number {
  const entry = store.get(ip)
  if (!entry) return 0
  return Math.ceil((entry.resetAt - Date.now()) / 1000)
}
