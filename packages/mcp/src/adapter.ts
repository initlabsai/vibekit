/**
 * The one generic ToolDefinition → MCP adapter (docs/DESIGN.md §5).
 * v1 had three of these copy-pasted; this is the only one.
 */
import { jsonSafe, ToolError, type AnyTool, type ToolContext } from '@initlabs/core'
import type { McpServer } from '@modelcontextprotocol/server'

/** Namespaced _meta key carrying the display hint to heads. */
export const DISPLAY_META_KEY = 'ai.vibekit/display'

export function registerTools(server: McpServer, tools: AnyTool[], context: ToolContext): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.parameters,
        annotations: { readOnlyHint: !tool.requiresSigner },
        _meta: tool.display ? { [DISPLAY_META_KEY]: tool.display } : undefined,
      },
      async (args: unknown) => {
        try {
          const result = jsonSafe(await tool.handler(context, args as never))
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
