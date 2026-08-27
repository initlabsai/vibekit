import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { diagnoseMcpConfig, fixMcpConfig, looksLikeV1 } from '../src/commands/doctor.js'
import { generateConfigs } from '../src/commands/init.js'

describe('diagnoseMcpConfig', () => {
  test('flags v1 legacy server key', () => {
    const issues = diagnoseMcpConfig(
      { mcpServers: { 'vibekit-mcp': { command: '/bin/true', args: ['mcp'] } } },
      () => true,
    )
    expect(issues.map((i) => i.code)).toContain('legacy-key')
  })

  test('flags $bunfs virtual paths (the compiled-binary init bug)', () => {
    const issues = diagnoseMcpConfig(
      { mcpServers: { vibekit: { command: '/$bunfs/root/vibekit', args: ['mcp'] } } },
      () => true,
    )
    expect(issues.map((i) => i.code)).toContain('bunfs-path')
  })

  test('flags dead binary paths and v1 env vars', () => {
    const issues = diagnoseMcpConfig(
      {
        mcpServers: {
          vibekit: { command: '/nope/vibekit', env: { ALGORAND_NETWORK: 'localnet' } },
        },
      },
      () => false,
    )
    expect(issues.map((i) => i.code).sort()).toEqual(['legacy-env', 'missing-binary'])
  })

  test('healthy v2 entry produces no issues', () => {
    const issues = diagnoseMcpConfig(
      {
        mcpServers: {
          vibekit: { command: '/usr/local/bin/vibekit', args: ['mcp'], env: { NETWORK: 'localnet' } },
        },
      },
      () => true,
    )
    expect(issues).toEqual([])
  })
})

describe('fixMcpConfig', () => {
  test('migrates the legacy key, rewrites the entry, preserves other servers', () => {
    const fixed = fixMcpConfig(
      {
        mcpServers: {
          'vibekit-mcp': { command: '/$bunfs/root/vibekit', env: { ALGORAND_NETWORK: 'x' } },
          kapa: { type: 'http', url: 'https://algorand-docs.mcp.kapa.ai/' },
          'my-custom': { command: 'my-server' },
        },
      },
      '/home/dev/.local/bin/vibekit',
    )
    const servers = fixed.mcpServers!
    expect(Object.keys(servers).sort()).toEqual(['kapa', 'my-custom', 'vibekit'])
    expect(servers['vibekit']!.command).toBe('/home/dev/.local/bin/vibekit')
    expect(servers['vibekit']!.env).toMatchObject({ NETWORK: 'localnet', SIGNING: 'execute' })
    expect(servers['my-custom']!.command).toBe('my-server')
  })
})

describe('looksLikeV1', () => {
  test('fingerprints v1 help text', () => {
    expect(looksLikeV1('vibekit vault <cmd>  Manage HashiCorp Vault\ndispenser login')).toBe(true)
    expect(looksLikeV1('vibekit localnet <cmd>  Manage the local Algorand network')).toBe(false)
  })
})

describe('generateConfigs migration', () => {
  test('merges into an existing .mcp.json: drops vibekit-mcp, keeps foreign servers', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibekit-migrate-test-'))
    writeFileSync(
      join(dir, '.mcp.json'),
      JSON.stringify({
        mcpServers: {
          'vibekit-mcp': { command: '/old/v1/vibekit', args: ['mcp'] },
          'my-custom': { command: 'my-server' },
        },
      }),
    )

    await generateConfigs({ agents: ['claude'], mcps: ['vibekit'], installPath: dir, selectedSkills: [] })

    const config = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, { command?: string }>
    }
    expect(Object.keys(config.mcpServers).sort()).toEqual(['my-custom', 'vibekit'])
    expect(config.mcpServers['my-custom']!.command).toBe('my-server')
    expect(config.mcpServers['vibekit']!.command).not.toContain('$bunfs')
  })
})
