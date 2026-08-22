/**
 * Persisted Explorer agent config: ~/.config/vibekit/config.json (0600),
 * written by `vibekit explore setup`, read by the TUI. Env vars override
 * the file. This module stays free of 'ai' imports so the CLI can pull it
 * through the ./config subpath without bundling the model SDKs.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'

import type { ProviderConfig } from './provider.js'

const agentSectionSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'openai-compatible', 'ollama', 'zerosignal']),
  model: z.string().min(1),
  baseUrl: z.string().min(1).optional(),
})

/** API keys never live in the file; they stay in env (ANTHROPIC_API_KEY, …). */
export type StoredAgentConfig = z.infer<typeof agentSectionSchema>

export function vibekitConfigPath(env: Record<string, string | undefined> = process.env): string {
  const base = env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(base, 'vibekit', 'config.json')
}

/** The stored agent section, or undefined when absent or malformed. */
export function loadStoredAgentConfig(
  env: Record<string, string | undefined> = process.env,
): StoredAgentConfig | undefined {
  try {
    const raw = JSON.parse(readFileSync(vibekitConfigPath(env), 'utf8')) as { agent?: unknown }
    const parsed = agentSectionSchema.safeParse(raw.agent)
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

/** Writes the agent section, preserving any other keys in config.json. */
export function saveStoredAgentConfig(
  config: StoredAgentConfig,
  env: Record<string, string | undefined> = process.env,
): string {
  const path = vibekitConfigPath(env)
  let existing: Record<string, unknown> = {}
  try {
    existing = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch {
    // First write, or unreadable JSON — start fresh rather than fail setup.
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ ...existing, agent: agentSectionSchema.parse(config) }, null, 2)}\n`, {
    mode: 0o600,
  })
  return path
}

const appEntrySchema = z.object({
  name: z.string().min(1),
  appId: z.number().int().nonnegative(),
})

const appsSectionSchema = z.record(z.string(), z.array(appEntrySchema))

/** One deployed-app association shown on the Explorer's My Apps screen. */
export type StoredAppEntry = z.infer<typeof appEntrySchema>

/** Deployed-app associations keyed by network id (localnet/testnet/mainnet). */
export type StoredApps = z.infer<typeof appsSectionSchema>

/** The stored apps section; absent or malformed reads as empty. */
export function loadStoredApps(
  env: Record<string, string | undefined> = process.env,
): StoredApps {
  try {
    const raw = JSON.parse(readFileSync(vibekitConfigPath(env), 'utf8')) as { apps?: unknown }
    const parsed = appsSectionSchema.safeParse(raw.apps)
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

/** Writes the apps section, preserving any other keys in config.json. */
export function saveStoredApps(
  apps: StoredApps,
  env: Record<string, string | undefined> = process.env,
): string {
  const path = vibekitConfigPath(env)
  let existing: Record<string, unknown> = {}
  try {
    existing = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch {
    // First write, or unreadable JSON — start fresh rather than fail.
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(
    path,
    `${JSON.stringify({ ...existing, apps: appsSectionSchema.parse(apps) }, null, 2)}\n`,
    { mode: 0o600 },
  )
  return path
}

/**
 * Effective agent config: env vars win over the stored file, so power
 * users and CI can override without touching setup.
 */
export function resolveAgentConfig(
  env: Record<string, string | undefined> = process.env,
): ProviderConfig | undefined {
  if (env.VIBEKIT_AGENT_MODEL) {
    return {
      provider: (env.VIBEKIT_AGENT_PROVIDER ?? 'ollama') as ProviderConfig['provider'],
      model: env.VIBEKIT_AGENT_MODEL,
      ...(env.VIBEKIT_AGENT_BASE_URL ? { baseUrl: env.VIBEKIT_AGENT_BASE_URL } : {}),
      ...(env.VIBEKIT_AGENT_API_KEY ? { apiKey: env.VIBEKIT_AGENT_API_KEY } : {}),
    }
  }
  return loadStoredAgentConfig(env)
}

export type { ProviderConfig } from './provider.js'
export {
  listZeroSignalModels,
  probeZeroSignal,
  ZEROSIGNAL_DEFAULT_BASE_URL,
  ZEROSIGNAL_SETUP_HINT,
  zeroSignalBaseUrl,
  zeroSignalSetupHint,
} from './zerosignal.js'
