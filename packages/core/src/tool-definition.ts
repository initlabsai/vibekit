import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { ZodSchema } from 'zod'

/** Framework-agnostic tool definition that both MCP server and AI SDK can consume. */
export interface ToolDefinition<TArgs = Record<string, unknown>> {
  name: string
  description: string
  parameters: ZodSchema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (algorand: AlgorandClient, args: any) => Promise<unknown>
}
