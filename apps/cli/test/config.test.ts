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

  test('agents declare distinct config files', () => {
    const files = AGENT_IDS.map((id) => AGENTS[id].configFile)
    expect(new Set(files).size).toBe(files.length)
  })

  test('codex is the only toml agent', () => {
    expect(AGENT_IDS.filter((id) => AGENTS[id].configFormat === 'toml')).toEqual(['codex'])
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
