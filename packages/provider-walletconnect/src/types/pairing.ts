/**
 * Pairing Types
 *
 * Types for wallet pairing requests and results.
 */

import type { AccountInfo, WalletId } from '@vibekit/provider-interface'

/**
 * Pairing request returned when initiating wallet connection.
 */
export interface PairingRequest {
  /** URI for wallet to scan/open */
  uri: string
  /** ASCII art QR code */
  qrAscii: string
  /** Base64 PNG data URL of QR code */
  qrDataUrl: string
  /** Human-readable instructions */
  instructions: string
  /** Promise that resolves when pairing completes */
  approval: Promise<PairingResult>
  /** Browser URL when using browser-based flow (only set when useBrowser: true) */
  browserUrl?: string
}

/**
 * Result after successful pairing.
 */
export interface PairingResult {
  walletId: WalletId
  walletName: string
  accounts: AccountInfo[]
  network: 'mainnet' | 'testnet'
}
