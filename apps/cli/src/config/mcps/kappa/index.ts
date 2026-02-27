import type { AgentId } from '../../agents'
import type { MCPDefinition, AgentMCPConfig } from '../types'

const KAPPA_URL = 'https://algorand-docs.mcp.kapa.ai/'

function getAgentConfig(agentId: AgentId): AgentMCPConfig | undefined {
  switch (agentId) {
    case 'claude':
    case 'cursor':
      return {
        serverKey: 'kappa',
        config: {
          type: 'http',
          url: KAPPA_URL,
        },
      }

    case 'copilot':
      return {
        serverKey: 'kappa',
        config: {
          type: 'http',
          url: KAPPA_URL,
        },
      }

    case 'codex':
      return {
        serverKey: 'kappa',
        config: {
          url: KAPPA_URL,
        },
      }

    case 'opencode':
      return {
        serverKey: 'kappa',
        config: {
          type: 'remote',
          url: KAPPA_URL,
          enabled: true,
        },
      }

    default:
      return undefined
  }
}

export const kappa: MCPDefinition = {
  id: 'kappa',
  displayName: 'Kappa MCP',
  description: 'Algorand documentation search via Kapa.ai',
  type: 'remote',
  category: 'documentation',
  requiresDocker: false,
  requiresAccountProvider: false,
  requiresGithubPat: false,
  requiresDispenser: false,
  getAgentConfig,
  hint: 'docs, search, knowledge base',
}
