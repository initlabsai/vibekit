/**
 * The one generic ToolDefinition → MCP adapter (docs/DESIGN.md §5).
 * v1 had three of these copy-pasted; this is the only one.
 *
 * Multi-network deployments (§10 state model): a `network` parameter is
 * injected into every tool schema — optional (falls back to the default) on
 * read tools, required on `requiresSigner` tools so nothing ever spends on a
 * silently-defaulted chain. Single-network deployments get no parameter.
 */
import { jsonSafe, ToolError, type AnyTool } from '@initlabs/core'
import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { ResolvedDeployment } from './options.js'

/** Namespaced _meta key carrying the display hint to heads. */
export const DISPLAY_META_KEY = 'ai.vibekit/display'

/** Reserved parameter name injected by multi-network deployments. */
export const NETWORK_PARAM = 'network'

function injectNetworkParam(tool: AnyTool, deployment: ResolvedDeployment): z.ZodType {
  if (deployment.networkIds.length < 2) return tool.parameters

  if (!(tool.parameters instanceof z.ZodObject)) {
    throw new Error(
      `Tool ${tool.name}: multi-network deployments require z.object() parameters so the network param can be injected`,
    )
  }
  if (NETWORK_PARAM in tool.parameters.shape) {
    throw new Error(`Tool ${tool.name}: '${NETWORK_PARAM}' is a reserved parameter name`)
  }

  const ids = deployment.networkIds as [string, ...string[]]
  const base = z.enum(ids)
  const networkSchema = tool.requiresSigner
    ? base.describe('Network to execute on. Required: never write to a defaulted chain.')
    : base.optional().describe(`Network to query (default: ${deployment.defaultNetwork})`)
  return tool.parameters.extend({ [NETWORK_PARAM]: networkSchema })
}

export function registerTools(server: McpServer, deployment: ResolvedDeployment): void {
  const multiNetwork = deployment.networkIds.length > 1

  for (const tool of deployment.tools) {
    const inputSchema = injectNetworkParam(tool, deployment)

    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema,
        annotations: { readOnlyHint: !tool.requiresSigner },
        _meta: tool.display ? { [DISPLAY_META_KEY]: tool.display } : undefined,
      },
      async (args: unknown) => {
        try {
          let handlerArgs = args as Record<string, unknown>
          let networkId = deployment.defaultNetwork
          if (multiNetwork && handlerArgs && typeof handlerArgs === 'object') {
            const { [NETWORK_PARAM]: requested, ...rest } = handlerArgs
            if (typeof requested === 'string') networkId = requested
            handlerArgs = rest
          }
          const context = deployment.contexts.get(networkId)
          if (!context) {
            throw new ToolError('UNKNOWN_NETWORK', `Network not served: ${networkId}`)
          }
          const result = jsonSafe(await tool.handler(context, handlerArgs as never))
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          }
        } catch (err) {
          const text =
            err instanceof ToolError
              ? `${err.code}: ${err.message}`
              : err instanceof Error
                ? err.message
                : String(err)
          return { content: [{ type: 'text' as const, text }], isError: true }
        }
      },
    )
  }
}
