import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { ZodSchema } from 'zod'

/** Function to resolve the sender account for signing */
export type ResolveSenderFn = (
  algorand: AlgorandClient,
  sender?: string
) => Promise<{ address: string }>

/** Function to resolve an app spec from inline JSON or a file path */
export type ResolveAppSpecFn = (
  appSpec?: string,
  appSpecPath?: string
) => Promise<string | undefined>

/** Context object passed to every tool handler. */
export interface ToolHandlerContext {
  algorand: AlgorandClient
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any
  resolveSender: ResolveSenderFn
  resolveAppSpec: ResolveAppSpecFn
}

/** Framework-agnostic tool definition that both MCP server and AI SDK can consume. */
export interface ToolDefinition<TArgs = Record<string, unknown>> {
  name: string
  description: string
  parameters: ZodSchema
  handler: (ctx: ToolHandlerContext) => Promise<unknown>
}
