/**
 * Wallet Provider Errors
 *
 * Custom error types for wallet operations.
 */

/**
 * Base error class for wallet operations.
 */
export class WalletError extends Error {
  readonly code: string
  readonly hint?: string

  constructor(message: string, code: string, hint?: string) {
    super(message)
    this.name = 'WalletError'
    this.code = code
    this.hint = hint
  }
}

/**
 * Error thrown when no session exists.
 */
export class NoSessionError extends WalletError {
  constructor(message = 'No active wallet session') {
    super(message, 'NO_SESSION', 'Use connect_walletconnect to connect a wallet.')
    this.name = 'NoSessionError'
  }
}

/**
 * Error thrown when session has expired.
 */
export class SessionExpiredError extends WalletError {
  constructor(message = 'Wallet session has expired') {
    super(message, 'SESSION_EXPIRED', 'Use connect_walletconnect to reconnect.')
    this.name = 'SessionExpiredError'
  }
}

/**
 * Error thrown when user rejects signing request.
 */
export class SigningRejectedError extends WalletError {
  constructor(message = 'Transaction signing was rejected') {
    super(message, 'SIGNING_REJECTED', 'The user declined to sign in the wallet app.')
    this.name = 'SigningRejectedError'
  }
}

/**
 * Error thrown when signing times out.
 */
export class SigningTimeoutError extends WalletError {
  constructor(message = 'Transaction signing timed out') {
    super(message, 'SIGNING_TIMEOUT', 'The wallet did not respond in time. Check the wallet app.')
    this.name = 'SigningTimeoutError'
  }
}

/**
 * Error thrown when trying to create an account (not supported).
 */
export class CannotCreateAccountError extends WalletError {
  constructor(message = 'Cannot create accounts in external wallet') {
    super(message, 'CANNOT_CREATE_ACCOUNT', 'Accounts are managed by the wallet app, not vibekit.')
    this.name = 'CannotCreateAccountError'
  }
}

/**
 * Error thrown when a wallet is not supported.
 */
export class WalletNotSupportedError extends WalletError {
  constructor(walletId: string, supported: string[]) {
    super(
      `Wallet "${walletId}" is not supported`,
      'WALLET_NOT_SUPPORTED',
      `Supported wallets: ${supported.join(', ')}`
    )
    this.name = 'WalletNotSupportedError'
  }
}

/**
 * Error thrown when bridge URL cannot be fetched.
 */
export class BridgeFetchError extends WalletError {
  constructor(cause: string) {
    super(
      `Failed to fetch WalletConnect bridge URL: ${cause}`,
      'BRIDGE_FETCH_FAILED',
      'Check your network connection.'
    )
    this.name = 'BridgeFetchError'
  }
}

/**
 * Error thrown for initialization failures.
 */
export class InitializationError extends WalletError {
  constructor(cause: string) {
    super(
      `Failed to initialize wallet: ${cause}`,
      'INITIALIZATION_FAILED',
      'Check your network connection.'
    )
    this.name = 'InitializationError'
  }
}
