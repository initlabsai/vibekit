/**
 * Session Store
 *
 * SQLite-based session persistence for wallet connections.
 * Stores session data per wallet in the vibekit database.
 */

import {
  getWalletSession,
  upsertWalletSession,
  deleteWalletSession,
  hasWalletSession as dbHasSession,
} from '@vibekit/db'
import type { StoredSession } from '../types/index.js'
import type { WalletId } from '@vibekit/provider-interface'

/**
 * Save a wallet session to the database.
 *
 * @param walletId - Wallet identifier
 * @param session - Session data to save
 */
export async function saveSession(
  walletId: WalletId,
  session: Omit<StoredSession, 'walletId' | 'storedAt'>
): Promise<void> {
  const storedSession: StoredSession = {
    ...session,
    walletId,
    storedAt: Date.now(),
  }

  upsertWalletSession(walletId, JSON.stringify(storedSession))
}

/**
 * Load a wallet session from the database.
 *
 * @param walletId - Wallet identifier
 * @returns Session data or null if not found
 */
export async function loadSession(walletId: WalletId): Promise<StoredSession | null> {
  try {
    const row = getWalletSession(walletId)
    if (!row) {
      return null
    }

    const stored = JSON.parse(row.session_data) as StoredSession

    // Basic validation - ensure required fields exist
    if (!stored.bridge || !stored.key || !stored.clientId || !stored.accounts) {
      await clearSession(walletId)
      return null
    }

    return stored
  } catch {
    // Invalid JSON or other error - treat as no session
    return null
  }
}

/**
 * Clear the stored wallet session.
 *
 * @param walletId - Wallet identifier
 */
export async function clearSession(walletId: WalletId): Promise<void> {
  deleteWalletSession(walletId)
}

/**
 * Check if a session exists.
 *
 * @param walletId - Wallet identifier
 * @returns True if session exists
 */
export async function hasSession(walletId: WalletId): Promise<boolean> {
  return dbHasSession(walletId)
}
