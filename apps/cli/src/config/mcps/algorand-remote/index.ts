import type { AgentId } from '../../agents'
import type { MCPDefinition, AgentMCPConfig } from '../types'

const ALGORAND_REMOTE_URL = 'https://algorandmcp.goplausible.xyz/sse'

// SSE-based MCPs require mcp-remote to bridge the connection
function getAgentConfig(agentId: AgentId): AgentMCPConfig | undefined {
  switch (agentId) {
    case 'claude':
    case 'cursor':
      return {
        serverKey: 'algorand-remote',
        config: {
          command: 'npx',
          args: ['-y', 'mcp-remote', ALGORAND_REMOTE_URL],
        },
      }

    case 'copilot':
      return {
        serverKey: 'algorand-remote',
        config: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', 'mcp-remote', ALGORAND_REMOTE_URL],
        },
      }

    case 'codex':
      return {
        serverKey: 'algorand-remote',
        config: {
          command: 'npx',
          args: ['-y', 'mcp-remote', ALGORAND_REMOTE_URL],
        },
      }

    case 'opencode':
      return {
        serverKey: 'algorand-remote',
        config: {
          type: 'local',
          command: ['npx', '-y', 'mcp-remote', ALGORAND_REMOTE_URL],
          enabled: true,
        },
      }

    default:
      return undefined
  }
}

export const algorandRemote: MCPDefinition = {
  id: 'algorand-remote',
  displayName: 'GoPlausible Remote MCP',
  description: 'Community MCP for ecosystem interactions',
  type: 'remote',
  category: 'development',
  requiresDocker: false,
  requiresAccountProvider: false,
  requiresGithubPat: false,
  getAgentConfig,
  hint: 'mainnet, testnet, NFTs',
}
