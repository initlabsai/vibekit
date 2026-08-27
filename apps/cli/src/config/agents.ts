/**
 * Agent registry — how to configure each supported AI coding agent.
 * Ported from v1 apps/cli (one module instead of a directory per agent).
 */

import { join } from 'path'

export interface AgentDefinition {
  id: string
  displayName: string
  /** Output config file path relative to the install dir (e.g. '.mcp.json'). */
  configFile: string
  configFormat?: 'json' | 'toml'
  /** Base MCP config the selected MCPs are merged into. */
  baseConfigTemplate: Record<string, unknown>
  /** Key used for MCP servers in this agent's config. */
  mcpServersKey: string
  /** Skills directory relative to the install dir; absent = agent has no skills dir. */
  skillsDir?: string
  /** Agent-specific pointer file (e.g. 'CLAUDE.md') and its content. */
  templateFile?: string
  templateContent?: string
  /** Instructions for authenticating the Kapa MCP in this agent. */
  authInstructions?: string
  /** One-time setup the user must do for this agent (shown in the summary). */
  setupNote?: string
  /** CLI command to launch the agent after setup. */
  cliCommand?: string
}

const pointerContent = (
  relativeAgentsMd = './AGENTS.md',
) => `All agents should read \`AGENTS.md\` as the canonical source for project guidance.

See [AGENTS.md](${relativeAgentsMd}) for:

- Available skills and when to use them
- MCP tools for documentation, network queries, and transactions
- Development workflows for Algorand smart contracts
`

export const AGENTS = {
  claude: {
    id: 'claude',
    displayName: 'Claude Code',
    configFile: '.mcp.json',
    baseConfigTemplate: { mcpServers: {} },
    mcpServersKey: 'mcpServers',
    skillsDir: '.claude/skills',
    templateFile: 'CLAUDE.md',
    templateContent: `# CLAUDE.md\n\n${pointerContent()}`,
    authInstructions: 'In Claude Code: /mcp → kapa → Authenticate',
    cliCommand: 'claude',
  },
  codex: {
    id: 'codex',
    displayName: 'Codex',
    configFile: '.codex/config.toml',
    configFormat: 'toml',
    baseConfigTemplate: { mcp_servers: {} },
    mcpServersKey: 'mcp_servers',
    skillsDir: '.agents/skills',
    // Codex natively reads AGENTS.md — no separate pointer file needed
    authInstructions: 'In Codex: /mcp → kapa → Authenticate',
    cliCommand: 'codex',
  },
  copilot: {
    id: 'copilot',
    displayName: 'VS Code Copilot [EXPERIMENTAL]',
    configFile: '.vscode/mcp.json',
    baseConfigTemplate: { servers: {} },
    mcpServersKey: 'servers',
    skillsDir: '.github/skills',
    templateFile: '.github/copilot-instructions.md',
    templateContent: `# copilot-instructions.md\n\n${pointerContent('../AGENTS.md')}`,
    authInstructions: 'In VS Code: Open .vscode/mcp.json → Click "Start" above kapa',
  },
  cursor: {
    id: 'cursor',
    displayName: 'Cursor',
    configFile: '.cursor/mcp.json',
    baseConfigTemplate: { mcpServers: {} },
    mcpServersKey: 'mcpServers',
    skillsDir: '.cursor/rules',
    templateFile: '.cursorrules',
    templateContent: `# .cursorrules\n\n${pointerContent()}`,
    authInstructions: 'In Cursor Settings → MCP → kapa → Authenticate',
    cliCommand: 'cursor',
  },
  grok: {
    id: 'grok',
    displayName: 'Grok Build',
    // Native project TOML (highest precedence, committable). Grok can also
    // read .mcp.json, but that stops loading once the user imports or
    // dismisses its Claude-import prompt — too fragile to rely on.
    configFile: '.grok/config.toml',
    configFormat: 'toml',
    baseConfigTemplate: { mcp_servers: {} },
    mcpServersKey: 'mcp_servers',
    skillsDir: '.grok/skills',
    // Grok reads AGENTS.md natively — no pointer file.
    authInstructions: 'In Grok Build: /mcps → kapa (Grok handles the OAuth flow directly)',
    cliCommand: 'grok',
  },
  pi: {
    id: 'pi',
    displayName: 'Pi',
    // pi-mcp-adapter reads the standard project .mcp.json (same file and
    // format Claude Code uses); pi reads AGENTS.md natively — no pointer file.
    configFile: '.mcp.json',
    baseConfigTemplate: { mcpServers: {} },
    mcpServersKey: 'mcpServers',
    skillsDir: '.pi/skills',
    authInstructions:
      'In pi: /mcp-auth kapa (first time; lazy servers show "not cached" until first use)',
    setupNote: 'Pi needs the MCP adapter once: pi install npm:pi-mcp-adapter',
    cliCommand: 'pi',
  },
  opencode: {
    id: 'opencode',
    displayName: 'OpenCode',
    configFile: 'opencode.json',
    baseConfigTemplate: { $schema: 'https://opencode.ai/config.json', mcp: {} },
    mcpServersKey: 'mcp',
    skillsDir: '.opencode/skill',
    authInstructions: 'Run: opencode mcp auth kapa',
    cliCommand: 'opencode',
  },
} as const satisfies Record<string, AgentDefinition>

export type AgentId = keyof typeof AGENTS
export const AGENT_IDS = Object.keys(AGENTS) as AgentId[]
export type AgentSelection = AgentId[]

export function getEnabledAgents(selected: AgentSelection): AgentDefinition[] {
  return selected.map((id) => AGENTS[id])
}

export function getAgentSkillsDirs(basePath: string, selected: AgentSelection): string[] {
  return getEnabledAgents(selected)
    .filter((agent) => agent.skillsDir)
    .map((agent) => join(basePath, agent.skillsDir!))
}
