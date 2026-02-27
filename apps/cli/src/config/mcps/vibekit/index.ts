import type { AgentId } from '../../agents'
import type { MCPDefinition, AgentMCPConfig } from '../types'

function getAgentConfig(agentId: AgentId): AgentMCPConfig | undefined {
  switch (agentId) {
    case 'claude':
    case 'cursor':
      return {
        serverKey: 'vibekit-mcp',
        config: {
          command: '$VIBEKIT_PATH',
          args: ['mcp'],
          env: '$MCP_ENV',
        },
      }

    case 'copilot':
      return {
        serverKey: 'vibekit-mcp',
        config: {
          type: 'stdio',
          command: '$VIBEKIT_PATH',
          args: ['mcp'],
          env: '$MCP_ENV',
        },
      }

    case 'codex':
      return {
        serverKey: 'vibekit-mcp',
        config: {
          command: '$VIBEKIT_PATH',
          args: ['mcp'],
          env: '$MCP_ENV',
        },
      }

    case 'opencode':
      return {
        serverKey: 'vibekit-mcp',
        config: {
          type: 'local',
          command: '$VIBEKIT_COMMAND_ARRAY',
          environment: '$MCP_ENV',
          enabled: true,
        },
      }

    default:
      return undefined
  }
}

export const vibekit: MCPDefinition = {
  id: 'vibekit',
  displayName: 'VibeKit MCP',
  description: 'Official VibeKit MCP, tuned for development',
  type: 'local',
  category: 'development',
  requiresDocker: true,
  requiresAccountProvider: true,
  requiresGithubPat: true,
  requiresDispenser: true,
  getAgentConfig,
  hint: 'transactions, accounts, localnet',
}
