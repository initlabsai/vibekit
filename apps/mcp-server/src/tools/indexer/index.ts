/**
 * Indexer Tools
 *
 * Wraps @vibekit/indexer tool definitions as MCP tool registrations.
 * This gives the MCP server all 16 indexer tools from the shared package.
 */

import { indexerTools as sharedTools } from '@vibekit/indexer'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolRegistration } from '../types.js'

export const indexerTools: ToolRegistration[] = sharedTools.map((tool) => ({
  definition: {
    name: `indexer_${tool.name}`,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.parameters, { target: 'openApi3' }) as Tool['inputSchema'],
  },
  handler: async (args, ctx) => {
    const indexer = ctx.algorand.client.indexer
    return tool.handler(indexer, args)
  },
}))
