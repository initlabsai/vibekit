/** Shared utilities used across tool packages. */

/**
 * Concurrency semaphore for limiting parallel async operations —
 * prevents thundering-herd 429s against rate-limited public nodes.
 */
export class Semaphore {
  private queue: (() => void)[] = []
  private running = 0

  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
  }

  private release(): void {
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.running--
    }
  }
}

/** Shared semaphore for indexer/algod fan-out requests — sized for public free-tier rate limits. */
export const indexerSemaphore = new Semaphore(6)

/** Default result limit for paginated queries. */
export const DEFAULT_LIMIT = 20

/** Drop nextToken when the result set is smaller than the requested page size. */
export function stripFinalToken(count: number, limit: number, token?: string): string | undefined {
  return count < limit ? undefined : token
}

/** Format a raw integer asset amount with decimals into a human-readable string. */
export function formatAssetAmount(rawAmount: string, decimals: number): string {
  const num = BigInt(rawAmount)
  if (decimals === 0) return Number(num).toLocaleString('en-US')
  const divisor = BigInt(10 ** decimals)
  const whole = num / divisor
  const frac = num % divisor
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  if (!fracStr) return Number(whole).toLocaleString('en-US')
  return `${Number(whole).toLocaleString('en-US')}.${fracStr}`
}
