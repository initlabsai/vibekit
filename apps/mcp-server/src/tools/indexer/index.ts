/**
 * Domain Tools Adapter
 *
 * Wraps domain package tool definitions (read + write) as MCP tool registrations.
 * All tools get resolveSender and resolveAppSpec injected; read tools simply ignore them.
 */

import { networkTools, utilityTools } from '@vibekit/network'
import { accountTools, accountWriteTools } from '@vibekit/accounts'
import { assetTools, assetWriteTools } from '@vibekit/assets'
import { contractTools, contractWriteTools } from '@vibekit/contracts'
import { transactionTools, transactionWriteTools } from '@vibekit/transactions'
import { ecosystemTools } from '@vibekit/ecosystem'
import type { ToolDefinition } from '@vibekit/core'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolRegistration } from '../types.js'
import { resolveSender } from '../../lib/account-service.js'
import { readFile } from 'node:fs/promises'
import type { ResolveAppSpecFn } from '@vibekit/core'

const resolveAppSpecFromFs: ResolveAppSpecFn = async (appSpec, appSpecPath) => {
  if (appSpecPath) return readFile(appSpecPath, 'utf-8')
  return appSpec
}

const allDomainTools: ToolDefinition[] = [
  ...networkTools,
  ...accountTools,
  ...assetTools,
  ...contractTools,
  ...transactionTools,
  ...assetWriteTools,
  ...contractWriteTools,
  ...accountWriteTools,
  ...transactionWriteTools,
  ...utilityTools,
  ...ecosystemTools,
]

export const indexerTools: ToolRegistration[] = allDomainTools.map((tool) => ({
  definition: {
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.parameters, { target: 'openApi3' }) as Tool['inputSchema'],
  },
  handler: async (args, ctx) => {
    const mcpResolveSender = (alg: typeof ctx.algorand, sender?: string) =>
      resolveSender(alg, ctx.config, sender)
    const result = await tool.handler({ algorand: ctx.algorand, args, resolveSender: mcpResolveSender, resolveAppSpec: resolveAppSpecFromFs })
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return { ...result, network: ctx.config.network }
    }
    return result
  },
}))
