/**
 * WalletConnect Session Serialization
 *
 * Handles session storage, restoration, and serialization for WalletConnect v1.
 * Provides a clean abstraction over session persistence.
 */

import type { IConnector, IClientMeta } from '@walletconnect/types'
import type { WalletId } from '@vibekit/provider-interface'
import type { StoredSession, WalletMetadata } from '../types/index.js'
import { saveSession, loadSession, clearSession } from './store.js'

/**
 * Convert WalletMetadata to WalletConnect's IClientMeta format.
 */
export function toClientMeta(metadata: WalletMetadata): IClientMeta {
  return {
    name: metadata.name,
    description: metadata.description,
    url: metadata.url,
    icons: metadata.icons,
  }
}

/**
 * Extract session data from a WalletConnect connector for storage.
 */
export function extractSessionData(
  connector: IConnector
): Omit<StoredSession, 'walletId' | 'storedAt'> {
  const session = connector.session
  return {
    bridge: session.bridge,
    key: session.key,
    clientId: session.clientId,
    peerId: session.peerId,
    peerMeta: session.peerMeta
      ? {
          name: session.peerMeta.name,
          description: session.peerMeta.description,
          url: session.peerMeta.url,
          icons: session.peerMeta.icons,
        }
      : undefined,
    accounts: session.accounts,
    chainId: session.chainId,
    handshakeTopic: session.handshakeTopic,
    handshakeId: session.handshakeId,
  }
}

/**
 * Build WalletConnect session options from stored session data.
 */
export function buildSessionOptions(session: StoredSession, clientMeta: IClientMeta) {
  return {
    connected: true,
    accounts: session.accounts,
    chainId: session.chainId,
    bridge: session.bridge,
    key: session.key,
    clientId: session.clientId,
    clientMeta,
    peerId: session.peerId,
    peerMeta: session.peerMeta ? toClientMeta(session.peerMeta) : null,
    handshakeId: session.handshakeId,
    handshakeTopic: session.handshakeTopic,
  }
}

/**
 * WalletConnect session manager.
 * Handles loading, saving, and clearing sessions for a specific wallet.
 */
export class WalletConnectSessionManager {
  constructor(private readonly walletId: WalletId) {}

  /**
   * Load stored session from database.
   */
  async load(): Promise<StoredSession | null> {
    return loadSession(this.walletId)
  }

  /**
   * Save current connector session to database.
   */
  async save(connector: IConnector): Promise<void> {
    if (!connector.connected) return
    const sessionData = extractSessionData(connector)
    await saveSession(this.walletId, sessionData)
  }

  /**
   * Clear stored session from database.
   */
  async clear(): Promise<void> {
    await clearSession(this.walletId)
  }

  /**
   * Check if a session exists.
   */
  async exists(): Promise<boolean> {
    const session = await this.load()
    return session !== null
  }
}
