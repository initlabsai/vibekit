/**
 * Token Database Operations
 *
 * Stores low-grade secrets in SQLite instead of OS keyring.
 * These are tokens that don't require hardware-level security:
 * - GitHub PAT (read-only public repo access)
 * - TestNet dispenser token (testnet funding only)
 *
 * High-grade secrets (Vault MCP token, mnemonics) remain in OS keyring.
 */

import { getDb } from './database.js'

/** Well-known token keys */
export const TOKEN_KEYS = {
  GITHUB_TOKEN: 'github-token',
  DISPENSER_TOKEN: 'dispenser-token',
} as const

export type TokenKey = (typeof TOKEN_KEYS)[keyof typeof TOKEN_KEYS]

// Generic token operations

export function getToken(key: string): string | null {
  try {
    const row = getDb().query('SELECT value FROM tokens WHERE key = ?').get(key) as {
      value: string
    } | null
    return row?.value ?? null
  } catch {
    return null
  }
}

export function setToken(key: string, value: string): void {
  const now = new Date().toISOString()
  getDb().run(
    `INSERT INTO tokens (key, value, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
    [key, value, now, now, value, now]
  )
}

export function deleteToken(key: string): void {
  getDb().run('DELETE FROM tokens WHERE key = ?', [key])
}

export function hasToken(key: string): boolean {
  return getToken(key) !== null
}

// Convenience functions for GitHub token

export function getGithubToken(): string | null {
  return getToken(TOKEN_KEYS.GITHUB_TOKEN)
}

export function setGithubToken(token: string): void {
  setToken(TOKEN_KEYS.GITHUB_TOKEN, token)
}

export function deleteGithubToken(): void {
  deleteToken(TOKEN_KEYS.GITHUB_TOKEN)
}

export function hasGithubToken(): boolean {
  return hasToken(TOKEN_KEYS.GITHUB_TOKEN)
}

// Convenience functions for dispenser token

export function getDispenserToken(): string | null {
  return getToken(TOKEN_KEYS.DISPENSER_TOKEN)
}

export function setDispenserToken(token: string): void {
  setToken(TOKEN_KEYS.DISPENSER_TOKEN, token)
}

export function deleteDispenserToken(): void {
  deleteToken(TOKEN_KEYS.DISPENSER_TOKEN)
}

export function hasDispenserToken(): boolean {
  return hasToken(TOKEN_KEYS.DISPENSER_TOKEN)
}
