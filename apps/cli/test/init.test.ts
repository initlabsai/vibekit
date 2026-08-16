import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { generateConfigs, resolveVibekitPath } from '../src/commands/init.js'

function makeDir(): string {
  return mkdtempSync(join(tmpdir(), 'vibekit-init-test-'))
}

describe('generateConfigs', () => {
  test('writes .mcp.json for claude with vibekit + kappa servers', async () => {
    const dir = makeDir()
    await generateConfigs({
      agents: ['claude'],
      mcps: ['vibekit', 'kappa'],
      installPath: dir,
      selectedSkills: [],
    })

    const config = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, Record<string, unknown>>
    }
    expect(Object.keys(config.mcpServers).sort()).toEqual(['kappa', 'vibekit'])

    const vibekit = config.mcpServers.vibekit!
    expect(vibekit.args).toEqual(['mcp'])
    // template vars are resolved, never written verbatim
    expect(vibekit.command).not.toBe('$VIBEKIT_PATH')
    expect(String(vibekit.command)).toContain('vibekit')
    expect(vibekit.env).toEqual({
      NETWORK: 'localnet',
      NETWORKS: 'localnet,testnet,mainnet',
      SIGNING: 'execute',
    })

    expect(config.mcpServers.kappa!.url).toBe('https://algorand-docs.mcp.kapa.ai/')
  })

  test('writes toml for codex', async () => {
    const dir = makeDir()
    await generateConfigs({
      agents: ['codex'],
      mcps: ['vibekit'],
      installPath: dir,
      selectedSkills: [],
    })

    const toml = readFileSync(join(dir, '.codex', 'config.toml'), 'utf-8')
    expect(toml).toContain('[mcp_servers.vibekit]')
    expect(toml).toContain('args = ["mcp"]')
    expect(toml).toContain('[mcp_servers.vibekit.env]')
    expect(toml).toContain('NETWORK = "localnet"')
  })

  test('writes opencode config with command array', async () => {
    const dir = makeDir()
    await generateConfigs({
      agents: ['opencode'],
      mcps: ['vibekit', 'context7'],
      installPath: dir,
      selectedSkills: [],
    })

    const config = JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf-8')) as {
      $schema: string
      mcp: Record<string, Record<string, unknown>>
    }
    expect(config.$schema).toBe('https://opencode.ai/config.json')
    const command = config.mcp.vibekit!.command as string[]
    expect(Array.isArray(command)).toBe(true)
    expect(command[1]).toBe('mcp')
    expect(config.mcp.context7!.type).toBe('remote')
  })

  test('skips the config file when no MCPs are selected', async () => {
    const dir = makeDir()
    await generateConfigs({ agents: ['claude'], mcps: [], installPath: dir, selectedSkills: [] })
    expect(() => readFileSync(join(dir, '.mcp.json'))).toThrow()
  })
})

describe('resolveVibekitPath', () => {
  test('bun-compiled binary: embedded $bunfs argv is never written; execPath wins', () => {
    expect(resolveVibekitPath('/$bunfs/root/vibekit', '/home/dev/.local/bin/vibekit', '/dev/bin')).toBe(
      '/home/dev/.local/bin/vibekit',
    )
  })

  test('invoked as an on-disk vibekit script: argv path wins', () => {
    expect(resolveVibekitPath('/usr/local/bin/vibekit', '/usr/local/bin/bun', '/dev/bin')).toBe(
      '/usr/local/bin/vibekit',
    )
  })

  test('dev mode (bun run src/index.ts): falls back to the compiled binary path', () => {
    expect(resolveVibekitPath('/repo/apps/cli/src/index.ts', '/usr/local/bin/bun', '/repo/apps/cli/bin/vibekit')).toBe(
      '/repo/apps/cli/bin/vibekit',
    )
  })
})
