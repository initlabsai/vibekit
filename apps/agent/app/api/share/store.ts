/**
 * Where a share lives: Vercel KV when its env is set, a per-process map
 * otherwise (next dev, tests). KV holds only the payload; the image is
 * derived per request and cached by the CDN.
 */
import { kv } from '@vercel/kv'

import { canonical, sharePayloadSchema, type SharePayload } from '../../../src/share'

const TTL_SECONDS = 90 * 24 * 60 * 60
// On globalThis because next dev compiles the API route and the page as separate module graphs in one process.
const memory = ((globalThis as { __shares?: Map<string, SharePayload> }).__shares ??= new Map())
const useKv = () => Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
const keyOf = (hash: string) => `share:${hash}`

export async function readShare(hash: string): Promise<SharePayload | undefined> {
  const raw = useKv() ? await kv.get(keyOf(hash)) : memory.get(hash)
  const parsed = sharePayloadSchema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}

/**
 * First write wins: 48 bits can be collided offline, so an existing key is
 * never overwritten — an identical payload refreshes the TTL (re-sharing is
 * idempotent), a different one is refused. A collision becomes a failed
 * share instead of a hijack.
 */
export async function writeShare(
  hash: string,
  payload: SharePayload,
): Promise<'created' | 'identical' | 'conflict'> {
  if (!useKv()) {
    const existing = memory.get(hash)
    if (existing === undefined) {
      memory.set(hash, payload)
      return 'created'
    }
    return canonical(existing) === canonical(payload) ? 'identical' : 'conflict'
  }
  const created = await kv.set(keyOf(hash), payload, { nx: true, ex: TTL_SECONDS })
  if (created) return 'created'
  const existing = await kv.get(keyOf(hash))
  if (canonical(existing) === canonical(payload)) {
    await kv.expire(keyOf(hash), TTL_SECONDS)
    return 'identical'
  }
  return 'conflict'
}

/** Test seam: forget the in-process shares. */
export function resetMemoryShares(): void {
  memory.clear()
}
