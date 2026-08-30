/**
 * The store behind credits and house caps: Vercel KV when its env is set, a
 * per-process map otherwise (next dev, tests). The logic is the package's.
 */
import { kv } from '@vercel/kv'
import { createCredits, memoryStore, type PayStore } from '@initlabs/vibekit/pay'

export { bearerOf, ipOf, TOKEN_PATTERN } from '@initlabs/vibekit/pay'

export const TURNS_PER_PACK = Number(process.env.AGENT_TURNS_PER_PACK ?? 25)
export const FREE_TURNS = Number(process.env.AGENT_FREE_TURNS ?? 3)

const memory = memoryStore()
const remote: PayStore | undefined =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? {
        async incrBy(key, by, ttlSeconds) {
          const next = await kv.incrby(key, by)
          if (ttlSeconds && next === by) await kv.expire(key, ttlSeconds)
          return next
        },
        get: async (key) => (await kv.get<string | number>(key)) ?? undefined,
        set: async (key, value) => void (await kv.set(key, value)),
      }
    : undefined
export const store: PayStore = remote ?? memory

export const credits = createCredits(store, { turnsPerPack: TURNS_PER_PACK, freeTurns: FREE_TURNS })
export const { balance, credit, spend, freeTurn, freeLeft, bindToken, payerForToken, houseTurn } = credits

/** The house-billed caps, kept on the ledger's store so they hold across isolates and cold starts. */
const DAILY_CAP = Number(process.env.AGENT_DAILY_CAP_TURNS ?? 300)
const IP_HOURLY_CAP = Number(process.env.AGENT_IP_HOURLY_CAP ?? 30)

/** House mode: the refusal for this IP, or nothing. */
export async function houseRefusal(ip: string): Promise<string | undefined> {
  const verdict = await houseTurn(ip, { daily: DAILY_CAP, hourly: IP_HOURLY_CAP })
  if (verdict === 'daily') return "the house is out of turns for today. i'll be here tomorrow."
  if (verdict === 'hourly') return "hmph. that's a lot of questions for one hour. give me a minute — or a few."
  return undefined
}

/** Test seam: forget the in-process ledger. */
export function resetMemoryLedger(): void {
  memory.clear()
}
