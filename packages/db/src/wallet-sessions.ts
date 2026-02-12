/**
 * Wallet Session Database Operations
 *
 * Stores WalletConnect session data in SQLite for persistence.
 * Sessions are stored as JSON blobs keyed by wallet ID.
 */

import { getDb } from './database.js'

/**
 * Row structure for wallet_sessions table.
 */
export interface WalletSessionRow {
  wallet_id: string
  session_data: string // JSON blob
  created_at: string
  updated_at: string
}

/**
 * Get a wallet session from the database.
 *
 * @param walletId - Wallet identifier (e.g., 'pera', 'defly')
 * @returns Session row or null if not found
 */
export function getWalletSession(walletId: string): WalletSessionRow | null {
  try {
    const row = getDb()
      .query('SELECT * FROM wallet_sessions WHERE wallet_id = ?')
      .get(walletId) as WalletSessionRow | null
    return row ?? null
  } catch {
    return null
  }
}

/**
 * Insert or update a wallet session in the database.
 *
 * @param walletId - Wallet identifier
 * @param sessionData - JSON string of session data
 */
export function upsertWalletSession(walletId: string, sessionData: string): void {
  const now = new Date().toISOString()
  getDb().run(
    `INSERT INTO wallet_sessions (wallet_id, session_data, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(wallet_id) DO UPDATE SET session_data = ?, updated_at = ?`,
    [walletId, sessionData, now, now, sessionData, now]
  )
}

/**
 * Delete a wallet session from the database.
 *
 * @param walletId - Wallet identifier
 */
export function deleteWalletSession(walletId: string): void {
  getDb().run('DELETE FROM wallet_sessions WHERE wallet_id = ?', [walletId])
}

/**
 * Check if a wallet session exists in the database.
 *
 * @param walletId - Wallet identifier
 * @returns True if session exists
 */
export function hasWalletSession(walletId: string): boolean {
  return getWalletSession(walletId) !== null
}
