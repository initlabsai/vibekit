import type { AgentId } from '../../agents'
import type { MCPDefinition, AgentMCPConfig } from '../types'

const CONTEXT7_URL = 'https://mcp.context7.com/mcp'
const ALGORAND_LIBRARY_ID = '/websites/dev_algorand_co'

function getAgentConfig(agentId: AgentId): AgentMCPConfig | undefined {
  switch (agentId) {
    case 'claude':
    case 'cursor':
      return {
        serverKey: 'context7',
        config: {
          type: 'http',
          url: CONTEXT7_URL,
        },
      }

    case 'copilot':
      return {
        serverKey: 'context7',
        config: {
          type: 'http',
          url: CONTEXT7_URL,
        },
      }

    case 'codex':
      return {
        serverKey: 'context7',
        config: {
          url: CONTEXT7_URL,
        },
      }

    case 'opencode':
      return {
        serverKey: 'context7',
        config: {
          type: 'remote',
          url: CONTEXT7_URL,
          enabled: true,
        },
      }

    default:
      return undefined
  }
}

export const context7: MCPDefinition = {
  id: 'context7',
  displayName: 'Context7',
  description: 'Algorand documentation via Context7',
  type: 'remote',
  category: 'documentation',
  requiresDocker: false,
  requiresAccountProvider: false,
  requiresGithubPat: false,
  requiresDispenser: false,
  getAgentConfig,
  hint: `Use library ID "${ALGORAND_LIBRARY_ID}" for Algorand docs. Free API key at context7.com/dashboard`,
}
