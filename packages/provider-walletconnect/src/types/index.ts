/**
 * Wallet Provider Types
 *
 * Type definitions for the modular wallet provider system.
 */

import type { TransactionSigner } from 'algosdk'
import type { AccountInfo } from '@vibekit/provider-interface'

// Re-export all types
export type { WalletConfig, WalletMetadata } from './config.js'
export type { PairingRequest, PairingResult } from './pairing.js'
export type { StoredSession } from './session.js'
export type { PeraConfig, WalletConnectTransaction } from './walletconnect.js'

// Import for use in WalletImplementation interface
import type { WalletConfig } from './config.js'
import type { PairingRequest } from './pairing.js'
import type { WalletId } from '@vibekit/provider-interface'
import type { PairingOptions } from '../pairing/flow.js'

// Re-export PairingOptions for consumers
export type { PairingOptions }

/**
 * Wallet implementation interface.
 * Each wallet (Pera, Defly, etc.) implements this.
 */
export interface WalletImplementation {
  readonly id: WalletId
  readonly name: string
  readonly icon?: string

  /** Initialize the wallet client */
  initialize(config: WalletConfig): Promise<void>

  /** Check if session exists */
  hasSession(): Promise<boolean>

  /** Resume existing session */
  resumeSession(): Promise<AccountInfo[]>

  /** Start new pairing flow */
  requestPairing(options?: PairingOptions): Promise<PairingRequest>

  /** Get current accounts */
  getAccounts(): AccountInfo[]

  /** Create transaction signer for account */
  createSigner(address: string): TransactionSigner

  /** Disconnect and clear session */
  disconnect(): Promise<void>
}
