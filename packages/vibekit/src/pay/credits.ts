/**
 * Credits: paid turns per payer address, reached only through a bearer token
 * minted when that address paid; free turns per IP per day; and the house
 * caps a free deployment rate-limits with. All counters live in the store.
 */
import type { PayStore } from './store.js'

/** A token is 32 random bytes as hex; the client makes it, the settle hook binds it. */
export const TOKEN_PATTERN = /^[0-9a-f]{64}$/
const DAY_SECONDS = 24 * 60 * 60

export interface CreditsOptions {
  turnsPerPack: number
  /** Free turns per IP per day. */
  freeTurns: number
}

export interface Credits {
  readonly turnsPerPack: number
  readonly freeTurns: number
  /** Paid turns left on an address. */
  balance(payer: string): Promise<number>
  /** Adds turns to the payer's paid balance; returns the new balance. */
  credit(payer: string, turns?: number): Promise<number>
  /** Takes one paid turn; `undefined` when there are none (nothing is taken). */
  spend(payer: string): Promise<number | undefined>
  /** Takes one of today's free turns for an IP; `undefined` when they are gone. */
  freeTurn(ip: string, now?: Date): Promise<number | undefined>
  freeLeft(ip: string, now?: Date): Promise<number>
  /** Binds a token to the address that just paid. Many tokens may name one address. */
  bindToken(token: string, payer: string): Promise<void>
  payerForToken(token: string | undefined): Promise<string | undefined>
  /** One counter for the day across everyone, one per IP per hour. Refused turns are not counted. */
  houseTurn(ip: string, caps: { daily: number; hourly: number }, now?: Date): Promise<'ok' | 'daily' | 'hourly'>
}

export function createCredits(store: PayStore, options: CreditsOptions): Credits {
  const { turnsPerPack, freeTurns } = options
  const dayKey = (ip: string, now: Date) => `free:${ip}:${now.toISOString().slice(0, 10)}`
  const readNumber = async (key: string) => Number((await store.get(key)) ?? 0)
  return {
    turnsPerPack,
    freeTurns,
    balance: async (payer) => Math.max(0, await readNumber(`credits:${payer}`)),
    credit: (payer, turns = turnsPerPack) => store.incrBy(`credits:${payer}`, turns),
    async spend(payer) {
      const paid = await store.incrBy(`credits:${payer}`, -1)
      if (paid >= 0) return paid
      await store.incrBy(`credits:${payer}`, 1)
      return undefined
    },
    async freeTurn(ip, now = new Date()) {
      const used = await store.incrBy(dayKey(ip, now), 1, DAY_SECONDS)
      if (used <= freeTurns) return freeTurns - used
      await store.incrBy(dayKey(ip, now), -1)
      return undefined
    },
    freeLeft: async (ip, now = new Date()) => Math.max(0, freeTurns - (await readNumber(dayKey(ip, now)))),
    bindToken: (token, payer) => store.set(`token:${token}`, payer),
    async payerForToken(token) {
      if (!token || !TOKEN_PATTERN.test(token)) return undefined
      const payer = await store.get(`token:${token}`)
      return typeof payer === 'string' ? payer : undefined
    },
    async houseTurn(ip, caps, now = new Date()) {
      const day = now.toISOString().slice(0, 10)
      const hour = now.toISOString().slice(0, 13)
      const total = await store.incrBy(`house:day:${day}`, 1, DAY_SECONDS)
      if (total > caps.daily) {
        await store.incrBy(`house:day:${day}`, -1)
        return 'daily'
      }
      const mine = await store.incrBy(`house:ip:${ip}:${hour}`, 1, 60 * 60)
      if (mine > caps.hourly) {
        await store.incrBy(`house:ip:${ip}:${hour}`, -1)
        await store.incrBy(`house:day:${day}`, -1)
        return 'hourly'
      }
      return 'ok'
    },
  }
}

/** The bearer token on a request, when it has one. */
export function bearerOf(request: Request): string | undefined {
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : undefined
}

/** The caller's IP as the platform reports it; `local` when nothing does. */
export function ipOf(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
}
