/**
 * Simple concurrency semaphore for limiting parallel async operations.
 * Use to prevent thundering-herd 429s against rate-limited APIs.
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

/** Shared global semaphore for Algorand indexer/algod requests (max 6 concurrent). */
export const indexerSemaphore = new Semaphore(20)
