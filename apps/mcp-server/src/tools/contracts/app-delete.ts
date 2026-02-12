/**
 * app_delete tool
 *
 * Deletes an application from the network.
 * Thin wrapper around sendTransactions() for app deletion.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { parseArgs, type ToolContext } from '../types.js'
import { resolveSender } from '../../lib/account-service.js'
import { sendTransactions } from '../transactions/index.js'

export const appDeleteTool: Tool = {
  name: 'app_delete',
  description:
    'Delete an application. Only the creator can delete. Removes the app from the network. Most contracts implement an ABI method for deletion - provide appSpec/appSpecPath and method to use it. Use appSpecPath for large specs (>2KB). Falls back to a bare delete call if no method is specified.',
  inputSchema: {
    type: 'object',
    properties: {
      appId: {
        type: 'number',
        description: 'The application ID',
      },
      appSpec: {
        type: 'string',
        description: 'App spec JSON for ABI method call. For small specs only.',
      },
      appSpecPath: {
        type: 'string',
        description:
          'Path to ARC-56/ARC-32 app spec JSON file. Recommended for large specs (>2KB) to avoid truncation issues.',
      },
      method: {
        type: 'string',
        description:
          'ABI method name for deletion (e.g., "delete", "destroy"). Required with appSpec/appSpecPath.',
      },
      args: {
        type: 'array',
        description: 'Method arguments if the delete method requires them',
        items: {},
      },
      sender: {
        type: 'string',
        description: 'Sender address. Defaults to active account.',
      },
      extraFee: {
        type: 'number',
        description: 'Extra fee in microALGO to cover inner transactions',
      },
      maxFee: {
        type: 'number',
        description: 'Max fee in microALGO',
      },
    },
    required: ['appId'],
  },
}

interface DeleteAppArgs {
  appId: number
  appSpec?: string
  appSpecPath?: string
  method?: string
  args?: unknown[]
  sender?: string
  extraFee?: number
  maxFee?: number
}

export async function handleAppDelete(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<{
  success: boolean
  txId: string
  confirmedRound?: number
  appId: number
}> {
  const { algorand, config } = ctx
  const typedArgs = parseArgs<DeleteAppArgs>(args)
  const {
    appId,
    appSpec,
    appSpecPath,
    method,
    args: methodArgs,
    sender,
    extraFee,
    maxFee,
  } = typedArgs

  const result = await sendTransactions(
    {
      transactions: [
        {
          type: 'app_delete',
          appId,
          appSpec,
          appSpecPath,
          method,
          args: methodArgs,
          extraFee,
          maxFee,
          sender,
        },
      ],
    },
    algorand,
    config,
    resolveSender
  )

  return {
    success: true,
    txId: result.txIds[0],
    confirmedRound: result.confirmedRound,
    appId,
  }
}
