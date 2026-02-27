/**
 * Codex Agent Definition
 */

import type { AgentDefinition } from '../types'

export const codex: AgentDefinition = {
  id: 'codex',
  displayName: 'Codex',
  configFile: '.codex/config.toml',
  configFormat: 'toml',
  baseConfigTemplate: {
    mcp_servers: {},
  },
  mcpServersKey: 'mcp_servers',
  skillsDir: '.agents/skills',
  // Codex natively reads AGENTS.md — no separate template file needed
  authInstructions: 'In Codex: /mcp → kappa → Authenticate',
  cliCommand: 'codex',
}
