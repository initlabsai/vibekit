export class VibeKitError extends Error {
  public readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'VibeKitError'
    this.status = status
  }
}

export class AuthError extends VibeKitError {
  constructor(message = 'Unauthorized') {
    super(message, 401)
    this.name = 'AuthError'
  }
}

export class RateLimitError extends VibeKitError {
  public readonly retryAfter: number | null

  constructor(retryAfter: number | null = null) {
    super('Rate limit exceeded', 429)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}
