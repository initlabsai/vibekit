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

/**
 * Validate and parse a metadata hash: 64 hex chars or 44 base64 chars (32 bytes).
 * Returns undefined when not provided; throws on invalid input.
 */
export function validateMetadataHash(hash: string | undefined): Uint8Array | undefined {
  if (!hash) return undefined

  let bytes: Uint8Array
  if (hash.length === 64) {
    const matches = hash.match(/.{2}/g)
    if (!matches || matches.some((b) => !/^[0-9a-fA-F]{2}$/.test(b))) {
      throw new Error('metadataHash must be 64 hex characters or 44 base64 characters (32 bytes)')
    }
    bytes = new Uint8Array(matches.map((byte) => parseInt(byte, 16)))
  } else if (hash.length === 44) {
    bytes = Uint8Array.from(atob(hash), (c) => c.charCodeAt(0))
  } else {
    throw new Error('metadataHash must be 64 hex characters or 44 base64 characters (32 bytes)')
  }
  if (bytes.length !== 32) {
    throw new Error('metadataHash must decode to exactly 32 bytes')
  }
  return bytes
}

