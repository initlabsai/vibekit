/**
 * The CLI's persistent config: ~/.config/vibekit/config.json.
 * The only state the CLI owns (§10) — BYOM model config + preferred network.
 */

import { homedir } from 'os'
import { dirname, join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'

import type { ProviderConfig } from '@initlabs/vibekit-agent'
import type { NetworkId } from '@initlabs/vibekit-core'

export interface UserConfig {
  model?: ProviderConfig
  defaultNetwork?: NetworkId
}

export function userConfigPath(): string {
  if (process.env.VIBEKIT_CONFIG_PATH) return process.env.VIBEKIT_CONFIG_PATH
  const base =
    process.platform === 'win32' && process.env.APPDATA
      ? process.env.APPDATA
      : join(homedir(), '.config')
  return join(base, 'vibekit', 'config.json')
}

export function loadUserConfig(): UserConfig {
  const path = userConfigPath()
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as UserConfig
  } catch {
    return {}
  }
}

export async function saveUserConfig(config: UserConfig): Promise<void> {
  const path = userConfigPath()
  await mkdir(dirname(path), { recursive: true })
  // may contain an API key — owner-only
  await writeFile(path, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 })
}
