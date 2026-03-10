/**
 * read_box tool
 *
 * Delegates to @vibekit/contracts for the domain logic.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { parseArgs, type ToolContext } from '../types.js'
import { readBoxState } from '@vibekit/contracts'

export const readBoxTool: Tool = {
  name: 'read_box',
  description: `Read a box value from a deployed application.

Supports two modes:
1. Simple box: Provide boxName for UTF-8 encoded box names
2. BoxMap: Provide keyPrefix + key + keyType for compound BoxMap keys

BoxMap keys are encoded as: prefix bytes + ABI-encoded key

Examples:
- Simple box: { "appId": 123, "boxName": "myBox" }
- BoxMap with uint64 key: { "appId": 123, "keyPrefix": "boxMap", "key": 1, "keyType": "uint64" }
- BoxMap with address key: { "appId": 123, "keyPrefix": "users", "key": "ABC123...", "keyType": "address" }
- BoxMap with string key: { "appId": 123, "keyPrefix": "names", "key": "alice", "keyType": "string" }`,
  inputSchema: {
    type: 'object',
    properties: {
      appId: {
        type: 'number',
        description: 'The application ID',
      },
      boxName: {
        type: 'string',
        description: 'The box name (will be encoded as UTF-8 bytes). Use this for simple boxes.',
      },
      keyPrefix: {
        type: 'string',
        description: 'The BoxMap key prefix. Use with key and keyType for BoxMap lookups.',
      },
      key: {
        type: ['string', 'number'],
        description:
          'The BoxMap key value. For uint64, use a number. For address or string, use a string.',
      },
      keyType: {
        type: 'string',
        enum: ['uint64', 'address', 'string'],
        description: 'The type of the BoxMap key. Defaults to "uint64" if not specified.',
      },
      appSpec: {
        type: 'string',
        description: 'Optional app spec JSON for better value decoding',
      },
    },
    required: ['appId'],
  },
}

interface ReadBoxArgs {
  appId: number
  boxName?: string
  keyPrefix?: string
  key?: string | number
  keyType?: 'uint64' | 'address' | 'string'
  appSpec?: string
}

export async function handleReadBox(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<{
  appId: number
  boxName: string
  exists: boolean
  value?: string
  valueBase64?: string
  size?: number
}> {
  const typedArgs = parseArgs<ReadBoxArgs>(args)
  return readBoxState(ctx.algorand, typedArgs)
}
