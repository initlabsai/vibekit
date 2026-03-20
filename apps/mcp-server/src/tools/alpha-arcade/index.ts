/**
 * Alpha Arcade Tools
 *
 * Wraps @vibekit/alpha-arcade tool definitions as MCP tool registrations.
 */

import { alphaArcadeTools, createAlphaClient } from '@vibekit/alpha-arcade'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolRegistration } from '../types.js'

export const alphaArcadeMcpTools: ToolRegistration[] = alphaArcadeTools.map((tool) => ({
  definition: {
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.parameters, { target: 'openApi3' }) as Tool['inputSchema'],
  },
  handler: async (args) => {
    const client = createAlphaClient()
    return tool.handler(client, args)
  },
}))
