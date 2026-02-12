/**
 * Session Types
 *
 * Types for stored wallet session data.
 */

import type { WalletId } from '@vibekit/provider-interface'
import type { WalletMetadata } from './config.js'

/**
 * Stored session data for persistence.
 */
export interface StoredSession {
  /** Wallet ID that created this session */
  walletId: WalletId
  /** Bridge URL */
  bridge: string
  /** Session key for encryption */
  key: string
  /** This client's ID */
  clientId: string
  /** Peer's client ID */
  peerId: string
  /** Peer's metadata */
  peerMeta?: WalletMetadata
  /** Connected accounts (Algorand addresses) */
  accounts: string[]
  /** Chain ID */
  chainId: number
  /** Handshake topic */
  handshakeTopic: string
  /** Handshake ID */
  handshakeId: number
  /** Timestamp when session was stored */
  storedAt: number
}
