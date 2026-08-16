import { describe, expect, test } from 'bun:test'

import { AGENTS, AGENT_IDS } from '../src/config/agents.js'
import { MCPS, MCP_IDS, getMCPsByCategory } from '../src/config/mcps.js'
import { getSkillNames } from '../src/skills/index.js'

describe('agent registry', () => {
  test('every agent produces a config for every MCP', () => {
    for (const agentId of AGENT_IDS) {
      for (const mcpId of MCP_IDS) {
        const config = MCPS[mcpId].getAgentConfig(agentId)
        expect(config, `${mcpId} config for ${agentId}`).toBeDefined()
        expect(config!.serverKey).toBeTruthy()
        expect(Object.keys(config!.config).length).toBeGreaterThan(0)
      }
    }
  })

  test('config files are distinct, except pi deliberately shares .mcp.json with claude', () => {
    const files = AGENT_IDS.map((id) => AGENTS[id].configFile)
    const sharers = AGENT_IDS.filter((id) => AGENTS[id].configFile === '.mcp.json')
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
    expect(AGENT_IDS.filter((id) => AGENTS[id].configFormat === 'toml').sort()).toEqual([
      'codex',
      'grok',
    ])
  })
})

describe('mcp registry', () => {
  test('categories split into documentation and development', () => {
    expect(getMCPsByCategory('documentation').map((m) => m.id).sort()).toEqual([
      'context7',
      'kappa',
    ])
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
    expect(names).toContain('vibekit-project-setup')
    expect(names).not.toContain('algorand-project-setup') // replaced upstream skill
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
      const parsed = Bun.YAML.parse(lines.slice(1, end).join('\n')) as { name?: string; description?: string }
      expect(parsed.name).toBe(skill.name)
      expect(typeof parsed.description).toBe('string')
    }
  })
})
