/**
 * The one generic ToolDefinition-to-MCP adapter.
 *
 * Network selection, context pooling, and result encoding live in core
 * (injectNetworkParam / executeToolCall) and are shared with the agent
 * orchestrator — this file only maps them onto the MCP wire shape.
 */
import { executeToolCall, injectNetworkParam, ToolError } from '../core/index.js'
import type { McpServer } from '@modelcontextprotocol/server'
import type { ResolvedDeployment } from './options.js'

/** Namespaced _meta key carrying the tool's view cue to heads. */
export const VIEW_META_KEY = 'ai.vibekit/view'

export { NETWORK_PARAM } from '../core/index.js'

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
        _meta: tool.view ? { [VIEW_META_KEY]: tool.view } : undefined,
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
