/**
 * Tool Types
 *
 * Unified types for the tool registry pattern.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { McpConfig } from '../config.js'

/**
 * Context passed to all tool handlers.
 * Handlers can destructure and use only what they need.
 */
export interface ToolContext {
  algorand: AlgorandClient
  config: McpConfig
}

/**
 * Unified handler signature for all tools.
 * @param args - Tool arguments from MCP request
 * @param ctx - Context with algorand client and config
 */
export type ToolHandler<TArgs = Record<string, unknown>> = (
  args: TArgs,
  ctx: ToolContext
) => Promise<unknown>

/**
 * A tool registration pairs a tool definition with its handler.
 */
export interface ToolRegistration {
  definition: Tool
  handler: ToolHandler
}

/**
 * Parse tool arguments with type assertion.
 * Reduces boilerplate of `args as unknown as T` pattern.
 */
export function parseArgs<T>(args: Record<string, unknown>): T {
  return args as unknown as T
}

/**
 * Symbol to identify tool results that include image content.
 */
export const IMAGE_RESULT = Symbol('IMAGE_RESULT')

/**
 * Tool result that includes both data and an image.
 * When a handler returns this type, handleToolCall will include
 * both a text content block (JSON data) and an image content block.
 */
export interface ToolResultWithImage {
  [IMAGE_RESULT]: true
  /** The data to JSON-serialize as text content */
  data: unknown
  /** Data URL (e.g., "data:image/png;base64,...") for image content */
  imageDataUrl: string
}

/**
 * Create a tool result that includes image content.
 */
export function withImage(data: unknown, imageDataUrl: string): ToolResultWithImage {
  return { [IMAGE_RESULT]: true, data, imageDataUrl }
}

/**
 * Check if a result is a ToolResultWithImage.
 */
export function isResultWithImage(result: unknown): result is ToolResultWithImage {
  return (
    typeof result === 'object' &&
    result !== null &&
    IMAGE_RESULT in result &&
    (result as ToolResultWithImage)[IMAGE_RESULT] === true
  )
}
