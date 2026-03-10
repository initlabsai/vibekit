/**
 * read_local_state tool
 *
 * Delegates to @vibekit/contracts for the domain logic.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { parseArgs, type ToolContext } from '../types.js'
import { readLocalState } from '@vibekit/contracts'

export const readLocalStateTool: Tool = {
  name: 'read_local_state',
  description: 'Read local state for a specific account from a deployed application.',
  inputSchema: {
    type: 'object',
    properties: {
      appId: {
        type: 'number',
        description: 'The application ID',
      },
      address: {
        type: 'string',
        description: 'The account address to read local state for',
      },
      appSpec: {
        type: 'string',
        description: 'Optional app spec JSON for better state decoding',
      },
    },
    required: ['appId', 'address'],
  },
}

interface ReadLocalStateArgs {
  appId: number
  address: string
  appSpec?: string
}

export async function handleReadLocalState(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<{ appId: number; address: string; state: Array<{ key: string; value: unknown; type: 'uint' | 'bytes' }> }> {
  const typedArgs = parseArgs<ReadLocalStateArgs>(args)
  return readLocalState(ctx.algorand, typedArgs)
}
