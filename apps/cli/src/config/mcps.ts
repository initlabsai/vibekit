/**
 * MCP registry — the MCP servers `vibekit init` can configure, and how each
 * agent's config file expresses them. Ported from v1 apps/cli, slimmed: no
 * Docker/provider/PAT/dispenser gating (the v2 MCP needs none of those).
 */

import type { AgentId } from './agents.js'

export type MCPCategory = 'documentation' | 'development'

export interface AgentMCPConfig {
  /** Key to use in the agent's MCP servers section. */
  serverKey: string
  config: Record<string, unknown>
}

export interface MCPDefinition {
  id: string
  displayName: string
  description: string
  category: MCPCategory
  getAgentConfig: (agentId: AgentId) => AgentMCPConfig | undefined
  hint?: string
}

/**
 * Environment for the local vibekit MCP: the dev stack serves all three named
 * networks (localnet default) and signs via the local keystore daemon when it
 * is running (execute mode falls back to compose if the daemon is down).
 */
export const MCP_ENV = {
  NETWORK: 'localnet',
  NETWORKS: 'localnet,testnet,mainnet',
  SIGNING: 'execute',
} as const

const vibekit: MCPDefinition = {
  id: 'vibekit',
  displayName: 'VibeKit MCP',
  description: 'Official VibeKit MCP — accounts, assets, transactions, contracts',
  category: 'development',
  hint: 'transactions, accounts, contracts, localnet',
  getAgentConfig: (agentId) => {
    switch (agentId) {
      case 'claude':
      case 'cursor':
      case 'codex':
      case 'pi':
        return {
          serverKey: 'vibekit',
          config: { command: '$VIBEKIT_PATH', args: ['mcp'], env: '$MCP_ENV' },
        }
      case 'copilot':
        return {
          serverKey: 'vibekit',
          config: { type: 'stdio', command: '$VIBEKIT_PATH', args: ['mcp'], env: '$MCP_ENV' },
        }
      case 'opencode':
        return {
          serverKey: 'vibekit',
          config: {
            type: 'local',
            command: '$VIBEKIT_COMMAND_ARRAY',
            environment: '$MCP_ENV',
            enabled: true,
          },
        }
    }
  },
}

const KAPPA_URL = 'https://algorand-docs.mcp.kapa.ai/'

const kappa: MCPDefinition = {
  id: 'kappa',
  displayName: 'Kappa MCP',
  description: 'Algorand documentation search via Kapa.ai',
  category: 'documentation',
  hint: 'docs, search, knowledge base',
  getAgentConfig: (agentId) => {
    switch (agentId) {
      case 'claude':
      case 'cursor':
      case 'copilot':
      case 'pi':
        return { serverKey: 'kappa', config: { type: 'http', url: KAPPA_URL } }
      case 'codex':
        return { serverKey: 'kappa', config: { url: KAPPA_URL } }
      case 'opencode':
        return { serverKey: 'kappa', config: { type: 'remote', url: KAPPA_URL, enabled: true } }
    }
  },
}

const CONTEXT7_URL = 'https://mcp.context7.com/mcp'
const ALGORAND_LIBRARY_ID = '/websites/dev_algorand_co'

const context7: MCPDefinition = {
  id: 'context7',
  displayName: 'Context7',
  description: 'Algorand documentation via Context7',
  category: 'documentation',
  hint: `Use library ID "${ALGORAND_LIBRARY_ID}" for Algorand docs`,
  getAgentConfig: (agentId) => {
    switch (agentId) {
      case 'claude':
      case 'cursor':
      case 'copilot':
      case 'pi':
        return { serverKey: 'context7', config: { type: 'http', url: CONTEXT7_URL } }
      case 'codex':
        return { serverKey: 'context7', config: { url: CONTEXT7_URL } }
      case 'opencode':
        return {
          serverKey: 'context7',
          config: { type: 'remote', url: CONTEXT7_URL, enabled: true },
        }
    }
  },
}

export const MCPS = { vibekit, kappa, context7 } as const

export type MCPId = keyof typeof MCPS
export const MCP_IDS = Object.keys(MCPS) as MCPId[]
export type MCPSelection = MCPId[]

export function getSelectedMCPs(selected: MCPSelection): MCPDefinition[] {
  return selected.map((id) => MCPS[id])
}

export function getMCPsByCategory(category: MCPCategory): MCPDefinition[] {
  return Object.values(MCPS).filter((mcp) => mcp.category === category)
}
