/**
 * Agent Registry
 *
 * Central registry for all supported AI coding agents.
 * Adding a new agent requires:
 * 1. Create a new directory under agents/ with index.ts and mcp.template.json
 * 2. Import and add to the AGENTS object below
 */

import { claude } from './claude'
import { codex } from './codex'
import { copilot } from './copilot'
import { cursor } from './cursor'
import { opencode } from './opencode'

export type { AgentDefinition } from './types'

/**
 * Registry of all supported agents
 */
export const AGENTS = {
  claude,
  codex,
  copilot,
  cursor,
  opencode,
} as const

/**
 * Valid agent IDs derived from the registry
 */
export type AgentId = keyof typeof AGENTS

/**
 * Array of all agent IDs
 */
export const AGENT_IDS = Object.keys(AGENTS) as AgentId[]

/**
 * Agent selection type - array of selected agents
 */
export type AgentSelection = AgentId[]

// Re-export utilities
export {
  getEnabledAgents,
  getAgentConfigPath,
  getAgentSkillsDir,
  getAgentTemplateFile,
  getAllAgentSkillsDirs,
  getAgentById,
  isValidAgentId,
} from './utils'
