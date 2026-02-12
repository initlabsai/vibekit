/**
 * Wallet Provider Constants
 *
 * Runtime constants for the wallet provider system.
 */

import type { WalletMetadata } from './types/index.js'

/**
 * WalletConnect chain IDs for Algorand networks.
 */
export const ALGORAND_CHAIN_IDS = {
  mainnet: 416001,
  testnet: 416002,
} as const

/**
 * Chain ID to network mapping.
 */
export const CHAIN_ID_TO_NETWORK: Record<number, 'mainnet' | 'testnet'> = {
  [ALGORAND_CHAIN_IDS.mainnet]: 'mainnet',
  [ALGORAND_CHAIN_IDS.testnet]: 'testnet',
}

/**
 * Pera Wallet config endpoint for getting bridge URLs.
 */
export const PERA_CONFIG_URL = 'https://wc.perawallet.app/config.json'

/**
 * Signing timeout in milliseconds (2 minutes).
 */
export const SIGNING_TIMEOUT_MS = 120_000

/**
 * Default application metadata for WalletConnect.
 */
export const DEFAULT_METADATA: WalletMetadata = {
  name: 'VibeKit',
  description: 'AI-powered Algorand development toolkit',
  url: 'https://getvibekit.ai',
  icons: ['https://getvibekit.ai/icon.png'],
}
