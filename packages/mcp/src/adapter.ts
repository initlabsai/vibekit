/**
 * The one generic ToolDefinition-to-MCP adapter.
 *
 * Network selection, context pooling, and result encoding live in core
 * (injectNetworkParam / executeToolCall) and are shared with the agent
 * orchestrator — this file only maps them onto the MCP wire shape.
 */
import { executeToolCall, injectNetworkParam, ToolError } from '@initlabs/vibekit-core'
import type { McpServer } from '@modelcontextprotocol/server'
import type { ResolvedDeployment } from './options.js'

/** Namespaced _meta key carrying the coarse display hint to heads. */
export const DISPLAY_META_KEY = 'ai.vibekit/display'

/** Namespaced _meta key carrying the Explorer view id to heads. */
export const VIEW_META_KEY = 'ai.vibekit/view'

export { NETWORK_PARAM } from '@initlabs/vibekit-core'

export function registerTools(server: McpServer, deployment: ResolvedDeployment): void {
  for (const tool of deployment.tools) {
    const inputSchema = injectNetworkParam(tool, deployment)

    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema,
        annotations: {
          readOnlyHint: !(tool.requiresSigner || tool.mutatesState),
          destructiveHint: Boolean(tool.requiresSigner || tool.mutatesState),
        },
        _meta: (() => {
          const meta: Record<string, string> = {}
          if (tool.view) meta[VIEW_META_KEY] = tool.view
          else if (tool.display) meta[DISPLAY_META_KEY] = tool.display
          return Object.keys(meta).length > 0 ? meta : undefined
        })(),
      },
      async (args: unknown) => {
        try {
          const result = await executeToolCall(deployment, tool, args)
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
