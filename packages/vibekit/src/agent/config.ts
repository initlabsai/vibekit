/**
 * Persisted Explorer config: ~/.config/vibekit/config.json (0600), written by
 * `vibekit explore setup` and the TUI, read by both. Each concern owns one
 * top-level key; writes preserve the others. Env vars override the file.
 * This module stays free of 'ai' imports so the CLI can pull it through the
 * ./config subpath without bundling the model SDKs.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'

import type { ProviderConfig } from './provider.js'

type Env = Record<string, string | undefined>

export function vibekitConfigPath(env: Env = process.env): string {
  const base = env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(base, 'vibekit', 'config.json')
}

function readConfig(env: Env): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(vibekitConfigPath(env), 'utf8')) as Record<string, unknown>
  } catch {
    return {} // no file yet, or unreadable JSON: every section reads as absent
  }
}

/** One top-level key of config.json: parsed on read (absent or malformed reads as `empty`), validated on write. */
function section<T>(key: string, schema: z.ZodType<T>, empty: T) {
  return {
    load(env: Env = process.env): T {
      const parsed = schema.safeParse(readConfig(env)[key])
      return parsed.success ? parsed.data : empty
    },
    /** Writes this section, preserving the others; returns the path. */
    save(value: T, env: Env = process.env): string {
      const path = vibekitConfigPath(env)
      mkdirSync(dirname(path), { recursive: true })
      const next = { ...readConfig(env), [key]: schema.parse(value) }
      writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
      return path
    },
  }
}

const agentSectionSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'openai-compatible', 'ollama', 'zerosignal']),
  model: z.string().min(1),
  baseUrl: z.string().min(1).optional(),
})

/** API keys never live in the file; they stay in env (ANTHROPIC_API_KEY, …). */
export type StoredAgentConfig = z.infer<typeof agentSectionSchema>

const agent = section<StoredAgentConfig | undefined>(
  'agent',
  agentSectionSchema.optional(),
  undefined,
)
export const loadStoredAgentConfig = agent.load
export const saveStoredAgentConfig = (config: StoredAgentConfig, env?: Env) =>
  agent.save(config, env)

const appEntrySchema = z.object({
  name: z.string().min(1),
  appId: z.number().int().nonnegative(),
})

/** One deployed-app association shown on the Explorer's My Apps screen. */
export type StoredAppEntry = z.infer<typeof appEntrySchema>

/** Deployed-app associations keyed by network id (localnet/testnet/mainnet). */
export type StoredApps = Record<string, StoredAppEntry[]>

const apps = section<StoredApps>('apps', z.record(z.string(), z.array(appEntrySchema)), {})
export const loadStoredApps = apps.load
export const saveStoredApps = apps.save

/** Plugin enablement by plugin name; a name absent from the map reads as enabled. */
export type StoredPlugins = Record<string, boolean>

const plugins = section<StoredPlugins>('plugins', z.record(z.string(), z.boolean()), {})
export const loadStoredPlugins = plugins.load
export const saveStoredPlugins = plugins.save

/**
 * Effective agent config: env vars win over the stored file, so power
 * users and CI can override without touching setup.
 */
export function resolveAgentConfig(env: Env = process.env): ProviderConfig | undefined {
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
  zeroSignalBaseUrl,
  zeroSignalSetupHint,
  readZeroSignalCatalog,
  formatZeroSignalPrice,
  type ZeroSignalModelInfo,
} from './zerosignal.js'
