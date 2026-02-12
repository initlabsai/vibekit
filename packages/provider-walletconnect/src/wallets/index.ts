/**
 * Wallet Registry
 *
 * Registry of supported wallet implementations.
 * Add new wallets here to enable them in the provider.
 */

import type { WalletId } from '@vibekit/provider-interface'
import type { WalletImplementation } from '../types/index.js'
import { PeraWallet } from './pera.js'

/**
 * Wallet implementation constructors.
 */
export const WALLET_REGISTRY: Record<WalletId, new () => WalletImplementation> = {
  pera: PeraWallet,
  // Future wallets:
  // defly: DeflyWallet,
  // lute: LuteWallet,
  // kibisis: KibisisWallet,
  defly: PeraWallet, // Placeholder - uses same WalletConnect v1 infrastructure
}

/**
 * Get list of supported wallet IDs.
 */
export function getSupportedWallets(): WalletId[] {
  return Object.keys(WALLET_REGISTRY) as WalletId[]
}

/**
 * Check if a wallet ID is supported.
 */
export function isWalletSupported(walletId: string): walletId is WalletId {
  return walletId in WALLET_REGISTRY
}

/**
 * Create a wallet implementation instance.
 */
export function createWalletImplementation(walletId: WalletId): WalletImplementation {
  const WalletClass = WALLET_REGISTRY[walletId]
  return new WalletClass()
}

export { PeraWallet }
