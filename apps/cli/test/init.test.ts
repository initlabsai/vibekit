import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { generateConfigs, parseInitArgs, runInitAt } from '../src/commands/init.js'
import { resolveVibekitPath } from '../src/utils/paths.js'
import { getAllSkillNames, getSkillNames } from '../src/skills/index.js'
import { mergeTomlMcpServers } from '../src/utils/toml.js'

function makeDir(prefix = 'vibekit-init-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

describe('parseInitArgs', () => {
  test('defaults: interactive, nothing pre-answered', () => {
    expect(parseInitArgs([])).toEqual({ yes: false, overwrite: false })
  })

  test('parses dir, --yes, --overwrite, and csv selections', () => {
    expect(
      parseInitArgs(['proj', '-y', '--overwrite', '--agents', 'claude,codex', '--mcps', 'vibekit']),
    ).toEqual({
      dir: 'proj',
      yes: true,
      overwrite: true,
      agents: ['claude', 'codex'],
      mcps: ['vibekit'],
      scope: 'project',
    })
  })

  test('--global sets scope and rejects a project directory', () => {
    expect(parseInitArgs(['--global', '--yes', '--agents', 'claude'])).toEqual({
      yes: true,
      overwrite: false,
      agents: ['claude'],
      scope: 'global',
    })
    expect(() => parseInitArgs(['proj', '--global'])).toThrow(/cannot be combined/)
  })

  test('--skills all expands to bundled plus catalog skills; none empties', () => {
    expect(parseInitArgs(['--skills', 'all']).skills).toEqual(getAllSkillNames())
    expect(parseInitArgs(['--skills', 'none']).skills).toEqual([])
    expect(parseInitArgs(['--mcps', 'none']).mcps).toEqual([])
  })

  test('accepts catalog-qualified skill names, rejects unknown ones', () => {
    expect(parseInitArgs(['--skills', 'use-vibekit,txnlab/nfd']).skills).toEqual([
      'use-vibekit',
      'txnlab/nfd',
    ])
    expect(() => parseInitArgs(['--skills', 'txnlab/bogus'])).toThrow(/unknown value/)
  })

  test('rejects unknown values and unknown flags', () => {
    expect(() => parseInitArgs(['--agents', 'clippy'])).toThrow(/unknown value/)
    expect(() => parseInitArgs(['--mcps', 'bogus'])).toThrow(/unknown value/)
    expect(() => parseInitArgs(['--agents'])).toThrow(/requires/)
    expect(() => parseInitArgs(['--frobnicate'])).toThrow(/Unknown argument/)
  })

  test('--yes without --agents is rejected (no default agent guess)', () => {
    expect(() => parseInitArgs(['--yes'])).toThrow(/--yes requires --agents/)
  })
})

describe('headless runInitAt', () => {
  test('--yes writes configs, skills, and AGENTS.md without prompting', async () => {
    const dir = makeDir()
    // bundled names only — catalog skills would fetch from GitHub in tests
    await runInitAt(
      dir,
      parseInitArgs([dir, '--yes', '--agents', 'claude', '--skills', getSkillNames().join(',')]),
    )

    const mcpConfig = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf-8'))
    expect(Object.keys(mcpConfig.mcpServers)).toEqual(expect.arrayContaining(['vibekit', 'kapa']))
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain('VibeKit')
    // Default agent set is claude → skills land in .claude/skills.
    const firstSkill = getSkillNames()[0]!
    expect(
      readFileSync(join(dir, '.claude', 'skills', firstSkill, 'SKILL.md'), 'utf-8'),
    ).toBeTruthy()
  })

  test('headless keeps existing AGENTS.md unless --overwrite', async () => {
    const dir = makeDir()
    writeFileSync(join(dir, 'AGENTS.md'), 'CUSTOMIZED')

    await runInitAt(dir, parseInitArgs([dir, '--yes', '--agents', 'claude', '--skills', 'none']))
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toBe('CUSTOMIZED')

    await runInitAt(
      dir,
      parseInitArgs([dir, '--yes', '--agents', 'claude', '--skills', 'none', '--overwrite']),
    )
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).not.toBe('CUSTOMIZED')
  })

  test('--global writes user-scoped MCP and skills under a fake home', async () => {
    const home = makeDir('vibekit-global-home-')
    const project = makeDir()
    const skillNames = getSkillNames()

    await runInitAt(project, {
      ...parseInitArgs([
        '--global',
        '--yes',
        '--agents',
        'claude',
        '--skills',
        skillNames.join(','),
      ]),
      homeDir: home,
    })

    const claudeJson = JSON.parse(readFileSync(join(home, '.claude.json'), 'utf-8')) as {
      mcpServers: Record<string, unknown>
    }
    expect(Object.keys(claudeJson.mcpServers).sort()).toEqual(['kapa', 'vibekit'])
    expect(existsSync(join(project, '.mcp.json'))).toBe(false)
    expect(existsSync(join(project, 'AGENTS.md'))).toBe(false)
    expect(readFileSync(join(home, '.claude', 'CLAUDE.md'), 'utf-8')).toContain('VibeKit')
    expect(
      readFileSync(join(home, '.claude', 'skills', skillNames[0]!, 'SKILL.md'), 'utf-8'),
    ).toBeTruthy()
  })

  test('generateConfigs global writes codex under fake home', async () => {
    const home = makeDir('vibekit-global-codex-')
    await generateConfigs({
      agents: ['codex'],
      mcps: ['vibekit', 'kapa'],
      installPath: makeDir(),
      selectedSkills: [],
      scope: 'global',
      homeDir: home,
    })
    const codexToml = readFileSync(join(home, '.codex', 'config.toml'), 'utf-8')
    expect(codexToml).toContain('[mcp_servers.vibekit]')
  })
})

describe('generateConfigs', () => {
  test('writes .mcp.json for claude with vibekit + kapa servers', async () => {
    const dir = makeDir()
    await generateConfigs({
      agents: ['claude'],
      mcps: ['vibekit', 'kapa'],
      installPath: dir,
      selectedSkills: [],
    })

    const config = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, Record<string, unknown>>
    }
    expect(Object.keys(config.mcpServers).sort()).toEqual(['kapa', 'vibekit'])

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

    expect(config.mcpServers.kapa!.url).toBe('https://algorand-docs.mcp.kapa.ai/')
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

  test('global toml merge preserves non-mcp sections', async () => {
    const home = makeDir('vibekit-toml-home-')
    mkdirSync(join(home, '.codex'), { recursive: true })
    const configPath = join(home, '.codex', 'config.toml')
    writeFileSync(
      configPath,
      ['model = "gpt-5"', '', '[mcp_servers.other]', 'command = "keep-me"', ''].join('\n'),
    )

    await generateConfigs({
      agents: ['codex'],
      mcps: ['vibekit'],
      installPath: makeDir(),
      selectedSkills: [],
      scope: 'global',
      homeDir: home,
    })

    const toml = readFileSync(configPath, 'utf-8')
    expect(toml).toContain('model = "gpt-5"')
    expect(toml).toContain('[mcp_servers.other]')
    expect(toml).toContain('command = "keep-me"')
    expect(toml).toContain('[mcp_servers.vibekit]')
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

describe('mergeTomlMcpServers', () => {
  test('replaces owned servers and keeps foreign sections', () => {
    const existing = [
      'model = "o3"',
      '',
      '[mcp_servers.vibekit]',
      'command = "old"',
      '',
      '[mcp_servers.vibekit.env]',
      'NETWORK = "mainnet"',
      '',
      '[mcp_servers.keep]',
      'url = "https://example.com"',
      '',
    ].join('\n')

    const merged = mergeTomlMcpServers(existing, {
      vibekit: { command: 'new', args: ['mcp'] },
    })
    expect(merged).toContain('model = "o3"')
    expect(merged).toContain('[mcp_servers.keep]')
    expect(merged).toContain('command = "new"')
    expect(merged).not.toContain('command = "old"')
    expect(merged).not.toContain('NETWORK = "mainnet"')
  })
})

describe('resolveVibekitPath', () => {
  test('bun-compiled binary: embedded $bunfs argv is never written; execPath wins', () => {
    expect(
      resolveVibekitPath('/$bunfs/root/vibekit', '/home/dev/.local/bin/vibekit', '/dev/bin'),
    ).toBe('/home/dev/.local/bin/vibekit')
  })

  test('invoked as an on-disk vibekit script: argv path wins', () => {
    expect(resolveVibekitPath('/usr/local/bin/vibekit', '/usr/local/bin/bun', '/dev/bin')).toBe(
      '/usr/local/bin/vibekit',
    )
  })

  test('dev mode (bun run src/index.ts): falls back to the from-source shim', () => {
    expect(
      resolveVibekitPath(
        '/repo/apps/cli/src/index.ts',
        '/usr/local/bin/bun',
        '/repo/apps/cli/scripts/vibekit-dev',
      ),
    ).toBe('/repo/apps/cli/scripts/vibekit-dev')
  })
})
