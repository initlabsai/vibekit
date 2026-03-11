/**
 * NFD Tools
 *
 * Wraps @vibekit/nfd tool definitions as MCP tool registrations.
 */

import { nfdTools as sharedTools, createNfdApiClient } from '@vibekit/nfd'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolRegistration } from '../types.js'

export const nfdTools: ToolRegistration[] = sharedTools.map((tool) => ({
  definition: {
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.parameters, { target: 'openApi3' }) as Tool['inputSchema'],
  },
  handler: async (args, ctx) => {
    const network = ctx.config.network
    const api = createNfdApiClient(network)
    return tool.handler(api, args)
  },
}))
