/**
 * The paywall's storage: three operations over a key space. Vercel KV, Redis,
 * a file — anything that counts atomically. The in-memory one is for one
 * process (dev, tests).
 */
export interface PayStore {
  /** Adds `by` and returns the new value; sets `ttlSeconds` when the key is created by this call. */
  incrBy(key: string, by: number, ttlSeconds?: number): Promise<number>
  get(key: string): Promise<string | number | undefined>
  set(key: string, value: string): Promise<void>
}

export function memoryStore(): PayStore & { clear(): void } {
  const memory = new Map<string, number | string>()
  return {
    async incrBy(key, by) {
      const next = Number(memory.get(key) ?? 0) + by
      memory.set(key, next)
      return next
    },
    async get(key) {
      return memory.get(key)
    },
    async set(key, value) {
      memory.set(key, value)
    },
    clear: () => memory.clear(),
  }
}
