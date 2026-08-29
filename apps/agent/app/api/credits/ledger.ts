/**
 * The credit ledger. Paid turns live per payer address and are reached only
 * through a bearer token minted when that address paid; free turns live per
 * IP per day and need nothing. Vercel KV when its env is set; a per-process
 * map otherwise (next dev).
 */
import { kv } from '@vercel/kv'

export const TURNS_PER_PACK = Number(process.env.AGENT_TURNS_PER_PACK ?? 25)
export const FREE_TURNS = Number(process.env.AGENT_FREE_TURNS ?? 3)
const DAY_SECONDS = 24 * 60 * 60

/** A token is 32 random bytes as hex; the browser makes it, the settle hook binds it. */
export const TOKEN_PATTERN = /^[0-9a-f]{64}$/

const memory = new Map<string, number | string>()
const remote = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN ? kv : undefined

async function incrBy(key: string, by: number, ttlSeconds?: number): Promise<number> {
  if (remote) {
    const next = await remote.incrby(key, by)
    if (ttlSeconds && next === by) await remote.expire(key, ttlSeconds)
    return next
  }
  const next = Number(memory.get(key) ?? 0) + by
  memory.set(key, next)
  return next
}

async function readNumber(key: string): Promise<number> {
  if (remote) return Number((await remote.get<number>(key)) ?? 0)
  return Number(memory.get(key) ?? 0)
}

/** Paid turns left on an address. */
export async function balance(payer: string): Promise<number> {
  return Math.max(0, await readNumber(`credits:${payer}`))
}

/** Adds turns to the payer's paid balance; returns the new balance. */
export async function credit(payer: string, turns = TURNS_PER_PACK): Promise<number> {
  return incrBy(`credits:${payer}`, turns)
}

/** Takes one paid turn; `undefined` when the address is dry, with nothing changed. */
export async function spend(payer: string): Promise<number | undefined> {
  const paid = await incrBy(`credits:${payer}`, -1)
  if (paid >= 0) return paid
  await incrBy(`credits:${payer}`, 1)
  return undefined
}

function dayKey(ip: string, now: Date): string {
  return `free:${ip}:${now.toISOString().slice(0, 10)}`
}

/** Takes one of today's free turns for an IP; `undefined` when they are gone. */
export async function freeTurn(ip: string, now = new Date()): Promise<number | undefined> {
  const used = await incrBy(dayKey(ip, now), 1, DAY_SECONDS)
  if (used <= FREE_TURNS) return FREE_TURNS - used
  await incrBy(dayKey(ip, now), -1)
  return undefined
}

export async function freeLeft(ip: string, now = new Date()): Promise<number> {
  return Math.max(0, FREE_TURNS - (await readNumber(dayKey(ip, now))))
}

/** Binds a token to the address that just paid. Many tokens may name one address. */
export async function bindToken(token: string, payer: string): Promise<void> {
  if (remote) await remote.set(`token:${token}`, payer)
  else memory.set(`token:${token}`, payer)
}

export async function payerForToken(token: string | undefined): Promise<string | undefined> {
  if (!token || !TOKEN_PATTERN.test(token)) return undefined
  const payer = remote ? await remote.get<string>(`token:${token}`) : memory.get(`token:${token}`)
  return typeof payer === 'string' ? payer : undefined
}

/** The bearer token on a request, when it has one. */
export function bearerOf(request: Request): string | undefined {
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : undefined
}

/** The caller's IP as the platform reports it; `local` in development. */
export function ipOf(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
}

/**
 * House mode's caps, on the same store: one counter for the day across everyone,
 * one per IP per hour, each expiring on its own. Refused turns are not counted.
 */
export async function houseTurn(ip: string, caps: { daily: number; hourly: number }, now = new Date()): Promise<'ok' | 'daily' | 'hourly'> {
  const day = now.toISOString().slice(0, 10)
  const hour = now.toISOString().slice(0, 13)
  const total = await incrBy(`house:day:${day}`, 1, DAY_SECONDS)
  if (total > caps.daily) {
    await incrBy(`house:day:${day}`, -1)
    return 'daily'
  }
  const mine = await incrBy(`house:ip:${ip}:${hour}`, 1, 60 * 60)
  if (mine > caps.hourly) {
    await incrBy(`house:ip:${ip}:${hour}`, -1)
    await incrBy(`house:day:${day}`, -1)
    return 'hourly'
  }
  return 'ok'
}

/** Test seam: forget the in-process ledger. */
export function resetMemoryLedger(): void {
  memory.clear()
}
