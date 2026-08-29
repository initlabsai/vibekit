import { describe, expect, test } from 'bun:test'
import { lstatSync, readlinkSync } from 'fs'
import { join, resolve } from 'path'

import { HARNESSES, HARNESS_IDS, resolveHarnessInstallPaths, type HarnessDefinition } from '../src/config/harnesses.js'
import { MCPS, MCP_IDS, getMCPsByCategory } from '../src/config/mcps.js'
import { getSkillNames } from '../src/skills/index.js'

describe('agent registry', () => {
  test('every agent produces a config for every MCP', () => {
    for (const agentId of HARNESS_IDS) {
      for (const mcpId of MCP_IDS) {
        const config = MCPS[mcpId].getAgentConfig(agentId)
        expect(config, `${mcpId} config for ${agentId}`).toBeDefined()
        expect(config!.serverKey).toBeTruthy()
        expect(Object.keys(config!.config).length).toBeGreaterThan(0)
      }
    }
  })

  test('config files are distinct, except pi deliberately shares .mcp.json with claude', () => {
    const files = HARNESS_IDS.map((id) => HARNESSES[id].configFile)
    const sharers = HARNESS_IDS.filter((id) => HARNESSES[id].configFile === '.mcp.json')
    expect(sharers.sort()).toEqual(['claude', 'pi']) // pi-mcp-adapter reads the standard .mcp.json
    expect(new Set(files).size).toBe(files.length - 1)
  })

  test('pi and claude produce identical .mcp.json server entries (shared file must agree)', () => {
    for (const mcpId of MCP_IDS) {
      const forClaude = MCPS[mcpId].getAgentConfig('claude')
      const forPi = MCPS[mcpId].getAgentConfig('pi')
      expect(forPi).toEqual(forClaude)
    }
  })

  test('codex and grok are the toml agents', () => {
    expect(
      HARNESS_IDS.filter(
        (id) => (HARNESSES[id] as HarnessDefinition).configFormat === 'toml',
      ).sort(),
    ).toEqual(['codex', 'grok'])
  })

  test('every harness declares global MCP and skills paths', () => {
    for (const id of HARNESS_IDS) {
      const agent = HARNESSES[id] as HarnessDefinition
      expect(agent.globalConfigFile, `${id} globalConfigFile`).toBeTruthy()
      expect(agent.globalSkillsDir, `${id} globalSkillsDir`).toBeTruthy()
    }
  })

  test('resolveHarnessInstallPaths maps global claude to ~/.claude.json', () => {
    const paths = resolveHarnessInstallPaths(HARNESSES.claude, 'global', '/proj', '/home/dev')
    expect(paths.configFile).toBe(join('/home/dev', '.claude.json'))
    expect(paths.skillsDir).toBe(join('/home/dev', '.claude', 'skills'))
    expect(paths.templateFile).toBe(join('/home/dev', '.claude', 'CLAUDE.md'))
  })
})

describe('mcp registry', () => {
  test('categories split into documentation and development', () => {
    expect(
      getMCPsByCategory('documentation')
        .map((m) => m.id)
        .sort(),
    ).toEqual(['context7', 'kapa'])
    expect(getMCPsByCategory('development').map((m) => m.id)).toEqual(['vibekit'])
  })
})

describe('bundled skills', () => {
  test('skills are bundled and named', () => {
    const names = getSkillNames()
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      expect(name).toMatch(/^[a-z0-9-]+$/)
    }
  })
})

describe('canonical skills', () => {
  test('the vibekit-authored skills are bundled', () => {
    const names = getSkillNames()
    expect(names).toContain('use-vibekit')
    expect(names).toContain('build-on-algorand')
    expect(names).toContain('audit-algorand')
    expect(names).toContain('build-on-vibekit')
    expect(names).toContain('update-skill')
    expect(names).not.toContain('vibekit-project-setup')
    expect(names).not.toContain('algorand-project-setup') // replaced upstream skill
  })
})

describe('repository skill discovery', () => {
  const repoRoot = resolve(import.meta.dir, '../../..')

  test('agent discovery roots link to the canonical skill tree', () => {
    for (const [path, target] of [
      ['.agents/skills', '../skills'],
      ['.claude/skills', '../skills'],
      ['.grok/skills', '../skills'],
    ]) {
      const fullPath = resolve(repoRoot, path)
      expect(lstatSync(fullPath).isSymbolicLink(), path).toBe(true)
      expect(readlinkSync(fullPath), path).toBe(target)
    }
  })
})

describe('skill frontmatter', () => {
  test('every bundled SKILL.md has strict-YAML frontmatter (pi hard-fails otherwise)', async () => {
    const { BUNDLED_SKILLS } = await import('../src/skills/bundled.js')
    for (const skill of BUNDLED_SKILLS) {
      const skillMd = skill.files.find((f) => f.path === 'SKILL.md')
      expect(skillMd, `${skill.name} has SKILL.md`).toBeDefined()
      const lines = skillMd!.content.split('\n')
      const end = lines.indexOf('---', 1)
      expect(lines[0]).toBe('---')
      const parsed = Bun.YAML.parse(lines.slice(1, end).join('\n')) as {
        name?: string
        description?: string
      }
      expect(parsed.name).toBe(skill.name)
      expect(typeof parsed.description).toBe('string')
    }
  })

  test('every direct bundled reference link resolves', async () => {
    const { BUNDLED_SKILLS } = await import('../src/skills/bundled.js')
    for (const skill of BUNDLED_SKILLS) {
      const files = new Set(skill.files.map((file) => file.path))
      const skillMd = skill.files.find((file) => file.path === 'SKILL.md')
      expect(skillMd, `${skill.name} has SKILL.md`).toBeDefined()

      for (const match of skillMd!.content.matchAll(/\]\((references\/[^)#]+\.md)(?:#[^)]+)?\)/g)) {
        const target = match[1]
        expect(target, `${skill.name} contains a reference target`).toBeDefined()
        expect(files.has(target!), `${skill.name} links ${target}`).toBe(true)
      }
    }
  })
})
