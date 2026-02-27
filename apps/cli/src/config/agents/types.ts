/**
 * Agent Configuration Types
 *
 * Defines the interface for agent-specific configuration.
 * Each agent uses a JSON template file that gets resolved at runtime.
 */

/**
 * Agent definition - describes how to configure an AI coding agent
 */
export interface AgentDefinition {
  /** Unique identifier for the agent */
  id: string

  /** Display name shown in UI */
  displayName: string

  /** Output config file path (e.g., '.mcp.json', '.cursor/mcp.json') */
  configFile?: string

  /** Config file format ('json' by default, 'toml' for Codex) */
  configFormat?: 'json' | 'toml'

  /** Base MCP config template (contains only kappa server, MCPs are merged in) */
  baseConfigTemplate?: Record<string, unknown>

  /** Key used for MCP servers in this agent's config ('mcpServers' | 'servers' | 'mcp') */
  mcpServersKey?: string

  /** Skills directory path relative to base (e.g., '.claude/skills') - optional, some agents may not have skills */
  skillsDir?: string

  /** Agent-specific template file (e.g., 'CLAUDE.md', '.cursorrules') */
  templateFile?: string

  /** Content of the template file - colocated with the agent definition */
  templateContent?: string

  /** Instructions for Kappa MCP authentication */
  authInstructions?: string

  /** CLI command to run after setup (e.g., 'opencode', 'claude') - optional */
  cliCommand?: string
}
