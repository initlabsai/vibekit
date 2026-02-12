/**
 * app_opt_in tool
 *
 * Opts an account into an application.
 * Thin wrapper around sendTransactions() for app opt-in.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { parseArgs, type ToolContext } from '../types.js'
import { resolveSender } from '../../lib/account-service.js'
import { sendTransactions } from '../transactions/index.js'

export const appOptInTool: Tool = {
  name: 'app_opt_in',
  description:
    'Opt an account into an application. Required before the account can have local state. Most contracts implement an ABI method for opt-in - provide appSpec/appSpecPath and method to use it. Use appSpecPath for large specs (>2KB). Falls back to a bare opt-in call if no method is specified.',
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
          'ABI method name for opt-in (e.g., "opt_in", "optIn"). Required with appSpec/appSpecPath.',
      },
      args: {
        type: 'array',
        description: 'Method arguments if the opt-in method requires them',
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

interface OptInArgs {
  appId: number
  appSpec?: string
  appSpecPath?: string
  method?: string
  args?: unknown[]
  sender?: string
  extraFee?: number
  maxFee?: number
}

export async function handleAppOptIn(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<{
  success: boolean
  txId: string
  confirmedRound?: number
  appId: number
}> {
  const { algorand, config } = ctx
  const typedArgs = parseArgs<OptInArgs>(args)
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
          type: 'app_opt_in',
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
