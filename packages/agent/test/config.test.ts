import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  loadStoredAgentConfig,
  loadStoredApps,
  resolveAgentConfig,
  saveStoredAgentConfig,
  saveStoredApps,
  vibekitConfigPath,
} from '../src/config.js'

function freshEnv(): Record<string, string | undefined> {
  return { XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'vibekit-config-')) }
}

describe('persisted agent config', () => {
  test('round-trips through config.json with 0600', () => {
    const env = freshEnv()
    saveStoredAgentConfig({ provider: 'zerosignal', model: 'llama-3.3-70b' }, env)
    expect(loadStoredAgentConfig(env)).toEqual({ provider: 'zerosignal', model: 'llama-3.3-70b' })
    expect(statSync(vibekitConfigPath(env)).mode & 0o777).toBe(0o600)
  })

  test('save preserves keys other sections wrote', async () => {
    const env = freshEnv()
    const path = vibekitConfigPath(env)
    saveStoredAgentConfig({ provider: 'ollama', model: 'qwen3:8b' }, env)
    const seeded = { ...JSON.parse(readFileSync(path, 'utf8')), keystore: { canary: true } }
    await Bun.write(path, JSON.stringify(seeded))
    saveStoredAgentConfig({ provider: 'zerosignal', model: 'llama-3.3-70b' }, env)
    const final = JSON.parse(readFileSync(path, 'utf8'))
    expect(final.keystore).toEqual({ canary: true })
    expect(final.agent.provider).toBe('zerosignal')
  })

  test('absent or malformed file reads as undefined', () => {
    const env = freshEnv()
    expect(loadStoredAgentConfig(env)).toBeUndefined()
  })

  test('apps section round-trips keyed by network and coexists with agent', () => {
    const env = freshEnv()
    saveStoredAgentConfig({ provider: 'ollama', model: 'qwen3:8b' }, env)
    saveStoredApps({ testnet: [{ name: 'Counter', appId: 1042 }], localnet: [] }, env)
    expect(loadStoredApps(env)).toEqual({ testnet: [{ name: 'Counter', appId: 1042 }], localnet: [] })
    expect(loadStoredAgentConfig(env)).toEqual({ provider: 'ollama', model: 'qwen3:8b' })
    expect(statSync(vibekitConfigPath(env)).mode & 0o777).toBe(0o600)
  })

  test('absent or malformed apps section reads as empty', async () => {
    const env = freshEnv()
    expect(loadStoredApps(env)).toEqual({})
    await Bun.write(vibekitConfigPath(env), JSON.stringify({ apps: { testnet: 'nope' } }))
    expect(loadStoredApps(env)).toEqual({})
  })

  test('env vars override the stored file', () => {
    const env = freshEnv()
    saveStoredAgentConfig({ provider: 'zerosignal', model: 'from-file' }, env)
    expect(resolveAgentConfig(env)).toEqual({ provider: 'zerosignal', model: 'from-file' })
    expect(
      resolveAgentConfig({ ...env, VIBEKIT_AGENT_MODEL: 'qwen3:32b' }),
    ).toEqual({ provider: 'ollama', model: 'qwen3:32b' })
  })
})
