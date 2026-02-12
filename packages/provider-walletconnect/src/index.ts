/**
 * Wallet Provider Package
 *
 * Mobile wallet signing via WalletConnect v1.
 * Supports Pera Wallet, Defly, and other WalletConnect-compatible wallets.
 *
 * Security model:
 * - Private keys never leave the mobile wallet
 * - User approves each transaction on their device
 * - Session data persisted locally for reconnection
 */

// Main provider exports
export {
  WalletProviderImpl,
  createWalletProvider,
  getSupportedWallets,
  isWalletSupported,
  type WalletProvider,
} from './provider.js'

// Error exports
export {
  WalletError,
  NoSessionError,
  SessionExpiredError,
  SigningRejectedError,
  SigningTimeoutError,
  CannotCreateAccountError,
  WalletNotSupportedError,
  BridgeFetchError,
  InitializationError,
} from './errors.js'

// Constants exports
export {
  ALGORAND_CHAIN_IDS,
  CHAIN_ID_TO_NETWORK,
  PERA_CONFIG_URL,
  DEFAULT_METADATA,
  SIGNING_TIMEOUT_MS,
} from './constants.js'

// Type exports
export {
  type WalletConfig,
  type WalletMetadata,
  type PairingRequest,
  type PairingResult,
  type StoredSession,
  type WalletImplementation,
  type WalletConnectTransaction,
} from './types/index.js'

// Session module exports
export { saveSession, loadSession, clearSession, hasSession } from './session/index.js'

// Pairing module exports
export { generateQR, type GeneratedQR } from './pairing/index.js'

// Signing module exports
export { createWalletConnectSigner } from './signing/index.js'

// Wallet implementations
export { PeraWallet } from './wallets/index.js'
