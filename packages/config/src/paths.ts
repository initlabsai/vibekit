/**
 * Shared config paths for VibeKit.
 *
 * Used by CLI and packages for consistent path resolution.
 */

import { join } from 'path'
import { homedir } from 'os'
import { existsSync, mkdirSync } from 'fs'
import { mkdir } from 'fs/promises'

/** Base config directory: ~/.config/vibekit (Unix) or %APPDATA%/vibekit (Windows) */
export function getVibekitDir(): string {
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'vibekit')
  }
  return join(homedir(), '.config', 'vibekit')
}

/** Ensure config directory exists with secure permissions */
export async function ensureVibekitDir(): Promise<void> {
  const dir = getVibekitDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true, mode: 0o700 })
  }
}

/** Sync version of ensureVibekitDir */
export function ensureVibekitDirSync(): void {
  const dir = getVibekitDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
}

/** Check if vibekit has been initialized */
export function isVibekitInitialized(): boolean {
  return existsSync(getVibekitDir())
}
