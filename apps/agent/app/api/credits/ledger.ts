/**
 * The credit ledger: turns bought per payer address, spent one per agent
 * turn, plus a small free allowance so a visitor can try her before paying.
 * Vercel KV when its env is set; a per-process map otherwise (next dev).
 */
import { kv } from '@vercel/kv'

export const TURNS_PER_PACK = Number(process.env.AGENT_TURNS_PER_PACK ?? 25)
export const FREE_TURNS = Number(process.env.AGENT_FREE_TURNS ?? 3)

const memory = new Map<string, number>()
const remote = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN ? kv : undefined

async function incrBy(key: string, by: number): Promise<number> {
  if (remote) return remote.incrby(key, by)
  const next = (memory.get(key) ?? 0) + by
  memory.set(key, next)
  return next
}

async function read(key: string): Promise<number> {
  if (remote) return Number((await remote.get<number>(key)) ?? 0)
  return memory.get(key) ?? 0
}

export interface Credits {
  paid: number
  freeLeft: number
}

export async function balance(payer: string): Promise<Credits> {
  const [paid, freeUsed] = await Promise.all([read(`credits:${payer}`), read(`free:${payer}`)])
  return { paid: Math.max(0, paid), freeLeft: Math.max(0, FREE_TURNS - freeUsed) }
}

/** Adds packs to the payer's paid turns; returns the new paid balance. */
export async function credit(payer: string, packs = 1): Promise<number> {
  return incrBy(`credits:${payer}`, packs * TURNS_PER_PACK)
}

/** Takes one turn: paid credit first, then the free allowance. `ok: false` leaves both untouched. */
export async function spend(payer: string): Promise<{ ok: boolean } & Credits> {
  const paid = await incrBy(`credits:${payer}`, -1)
  if (paid >= 0) return { ok: true, paid, freeLeft: (await balance(payer)).freeLeft }
  await incrBy(`credits:${payer}`, 1)
  const freeUsed = await incrBy(`free:${payer}`, 1)
  if (freeUsed <= FREE_TURNS) return { ok: true, paid: 0, freeLeft: FREE_TURNS - freeUsed }
  await incrBy(`free:${payer}`, -1)
  return { ok: false, paid: 0, freeLeft: 0 }
}

/** Test seam: forget the in-process ledger. */
export function resetMemoryLedger(): void {
  memory.clear()
}
