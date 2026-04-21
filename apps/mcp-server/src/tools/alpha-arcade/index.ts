/**
 * Alpha Arcade Tools
 *
 * Wraps @vibekit/alpha-arcade tool definitions as MCP tool registrations.
 */

import { alphaArcadeTools, createAlphaClient } from '@vibekit/alpha-arcade'
import type { ToolRegistration } from '../types.js'
import { createToolInputSchema } from '../schema.js'

export const alphaArcadeMcpTools: ToolRegistration[] = alphaArcadeTools.map((tool) => ({
  definition: {
    name: tool.name,
    description: tool.description,
    inputSchema: createToolInputSchema(tool.parameters),
  },
  handler: async (args) => {
    const client = createAlphaClient()
    return tool.handler(client, args)
  },
}))
