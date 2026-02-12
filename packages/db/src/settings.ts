/**
 * Settings Key-Value Store
 *
 * Simple key-value storage for user preferences like network selection.
 * Settings persist across restarts and are stored in the shared SQLite database.
 */

import { getDb } from './database.js'

/**
 * Get a setting value by key.
 * @param key - Setting key
 * @returns Setting value or null if not found
 */
export function getSetting(key: string): string | null {
  const db = getDb()
  const row = db.query<{ value: string }, [string]>('SELECT value FROM settings WHERE key = ?').get(key)
  return row?.value ?? null
}

/**
 * Set a setting value.
 * Creates the setting if it doesn't exist, updates if it does.
 * @param key - Setting key
 * @param value - Setting value
 */
export function setSetting(key: string, value: string): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.run(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now]
  )
}

/**
 * Delete a setting.
 * @param key - Setting key
 */
export function deleteSetting(key: string): void {
  const db = getDb()
  db.run('DELETE FROM settings WHERE key = ?', [key])
}

/**
 * Check if a setting exists.
 * @param key - Setting key
 * @returns true if setting exists
 */
export function hasSetting(key: string): boolean {
  return getSetting(key) !== null
}
