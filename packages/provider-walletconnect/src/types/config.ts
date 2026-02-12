/**
 * Configuration Types
 *
 * Types for wallet provider configuration and metadata.
 */

/**
 * Application metadata for WalletConnect.
 */
export interface WalletMetadata {
  name: string
  description: string
  url: string
  icons: string[]
}

/**
 * Configuration for wallet providers.
 */
export interface WalletConfig {
  /** Network to connect to */
  network: 'mainnet' | 'testnet'
  /** Application metadata */
  metadata?: WalletMetadata
  /** Custom bridge URL (optional) */
  bridgeUrl?: string
}
