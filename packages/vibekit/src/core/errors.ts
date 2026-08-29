/**
 * The error contract: handlers throw, hosts map once (MCP `isError`, API error
 * JSON). Tools never return `{ error }` result shapes.
 */
export class ToolError extends Error {
  constructor(
    /** Stable machine-readable code, e.g. 'INVALID_ADDRESS', 'NO_SIGNER'. */
    public readonly code: string,
    /** User-safe message — shown verbatim to the model/user. */
    message: string,
  ) {
    super(message)
    this.name = 'ToolError'
  }
}

/** The code every host and the model see when an upstream said "slow down". */
export const RATE_LIMITED = 'RATE_LIMITED'

/**
 * True for a 429 from anywhere: a ToolError a plugin already classified, an
 * algosdk/fetch error carrying the status, or a message that says so.
 */
export function isRateLimited(err: unknown): boolean {
  if (err instanceof ToolError) return err.code === RATE_LIMITED
  const record = (err ?? {}) as {
    status?: unknown
    response?: { status?: unknown }
    message?: unknown
  }
  if (record.status === 429 || record.response?.status === 429) return true
  const message = typeof record.message === 'string' ? record.message : ''
  return /\b429\b|rate.?limit|too many requests/i.test(message)
}

/**
 * What a thrown handler error becomes on the wire: a ToolError's own code and
 * message, a rate limit from any source as one code and one calm sentence,
 * anything else as TOOL_ERROR with the message it had.
 */
export function normalizeToolError(err: unknown): { code: string; message: string } {
  if (isRateLimited(err)) {
    return {
      code: RATE_LIMITED,
      message: 'That source is rate-limited right now — try again in a minute.',
    }
  }
  if (err instanceof ToolError) return { code: err.code, message: err.message }
  // Some SDKs reject with plain objects; take their message before falling back to String().
  const message = (err as { message?: unknown } | null)?.message
  return { code: 'TOOL_ERROR', message: typeof message === 'string' ? message : String(err) }
}
