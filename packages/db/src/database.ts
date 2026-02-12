/**
 * Shared SQLite Database Connection
 *
 * Singleton database instance for vibekit. Stores:
 * - accounts: Account metadata (name, address, created_at)
 * - tokens: Low-grade secrets (GitHub PAT, dispenser token)
 *
 * Database path: ~/.config/vibekit/accounts.db
 */

import { Database } from 'bun:sqlite'
import { join } from 'path'
import { getVibekitDir, ensureVibekitDirSync } from '@vibekit/config'

function getDbPath(): string {
  return join(getVibekitDir(), 'accounts.db')
}

let db: Database | null = null

/**
 * Get the shared database instance.
 * Creates and initializes the database if it doesn't exist.
 */
export function getDb(): Database {
  if (db) return db

  ensureVibekitDirSync()
  db = new Database(getDbPath())

  // Initialize accounts table
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      name TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  // Initialize tokens table for low-grade secrets
  db.run(`
    CREATE TABLE IF NOT EXISTS tokens (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Initialize wallet_sessions table for WalletConnect session persistence
  db.run(`
    CREATE TABLE IF NOT EXISTS wallet_sessions (
      wallet_id TEXT PRIMARY KEY,
      session_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Initialize settings table for user preferences (e.g., network selection)
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  return db
}

/**
 * Initialize the database. Called during CLI init.
 */
export function initDb(): void {
  getDb()
}
