/**
 * NFD Tools
 *
 * Wraps @vibekit/nfd tool definitions as MCP tool registrations.
 */

import { nfdTools as sharedTools, createNfdApiClient } from '@vibekit/tools'
import type { ToolRegistration } from '../types.js'
import { createToolInputSchema } from '../schema.js'

export const nfdTools: ToolRegistration[] = sharedTools.map((tool) => ({
  definition: {
    name: tool.name,
    description: tool.description,
    inputSchema: createToolInputSchema(tool.parameters),
  },
  handler: async (args, ctx) => {
    const network = ctx.config.network
    const api = createNfdApiClient(network)
    return tool.handler(api, args)
  },
}))
