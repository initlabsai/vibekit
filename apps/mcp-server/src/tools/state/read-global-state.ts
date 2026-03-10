/**
 * read_global_state tool
 *
 * Delegates to @vibekit/contracts for the domain logic.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { parseArgs, type ToolContext } from '../types.js'
import { readGlobalState } from '@vibekit/contracts'

export const readGlobalStateTool: Tool = {
  name: 'read_global_state',
  description: 'Read global state from a deployed application. Returns decoded key-value pairs.',
  inputSchema: {
    type: 'object',
    properties: {
      appId: {
        type: 'number',
        description: 'The application ID',
      },
      appSpec: {
        type: 'string',
        description: 'Optional app spec JSON for better state decoding',
      },
    },
    required: ['appId'],
  },
}

interface ReadGlobalStateArgs {
  appId: number
  appSpec?: string
}

export async function handleReadGlobalState(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<{ appId: number; state: Array<{ key: string; value: unknown; type: 'uint' | 'bytes' }> }> {
  const typedArgs = parseArgs<ReadGlobalStateArgs>(args)
  return readGlobalState(ctx.algorand, typedArgs)
}
