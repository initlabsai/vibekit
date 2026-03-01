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
 *
 * Note: structural validation happens in handleToolCall() before handlers
 * are invoked. This cast is safe because args have already been validated
 * against the tool's inputSchema.
 */
export function parseArgs<T>(args: Record<string, unknown>): T {
  return args as unknown as T
}

/** JSON Schema type for tool inputSchema definitions. */
interface JsonSchema {
  type: string
  properties?: Record<string, { type?: string | string[]; description?: string }>
  required?: string[]
}

/**
 * Validate tool arguments against the tool's inputSchema.
 *
 * Checks required fields are present and property types match schema.
 * Catches malformed AI-generated arguments early with clear error messages
 * instead of letting them propagate as cryptic runtime errors.
 *
 * @throws Error with a descriptive message listing all validation failures
 */
export function validateArgs(
  args: Record<string, unknown>,
  schema: JsonSchema,
  toolName: string
): void {
  const errors: string[] = []

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (args[field] === undefined || args[field] === null) {
        errors.push(`missing required field '${field}'`)
      }
    }
  }

  // Check property types for provided fields
  if (schema.properties) {
    for (const [key, prop] of Object.entries(args)) {
      const schemaProp = schema.properties[key]
      if (!schemaProp?.type) continue

      const actualType = Array.isArray(prop) ? 'array' : typeof prop
      const allowedTypes = Array.isArray(schemaProp.type) ? schemaProp.type : [schemaProp.type]

      // JSON Schema 'integer' maps to JS 'number'
      const normalizedAllowed = allowedTypes.map((t) => (t === 'integer' ? 'number' : t))

      if (!normalizedAllowed.includes(actualType)) {
        errors.push(
          `'${key}' expected ${allowedTypes.join(' | ')}, got ${actualType}`
        )
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid arguments for ${toolName}: ${errors.join('; ')}`)
  }
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
