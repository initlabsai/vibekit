/**
 * Shared Read Tools
 *
 * Wraps domain package tool definitions as MCP tool registrations.
 * Tools use canonical names (no `indexer_` prefix).
 */

import { networkTools } from '@vibekit/network'
import { accountTools } from '@vibekit/accounts'
import { assetTools } from '@vibekit/assets'
import { contractTools } from '@vibekit/contracts'
import { transactionTools } from '@vibekit/transactions'
import type { ToolDefinition } from '@vibekit/core'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolRegistration } from '../types.js'

const sharedTools: ToolDefinition[] = [
  ...networkTools,
  ...accountTools,
  ...assetTools,
  ...contractTools,
  ...transactionTools,
]

export const indexerTools: ToolRegistration[] = sharedTools.map((tool) => ({
  definition: {
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.parameters, { target: 'openApi3' }) as Tool['inputSchema'],
  },
  handler: async (args, ctx) => {
    return tool.handler(ctx.algorand, args)
  },
}))
