import type { ZodTypeAny } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'

type JsonSchema = Record<string, unknown>

function normalizeArrayItems(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(normalizeArrayItems)
  }

  if (!schema || typeof schema !== 'object') {
    return schema
  }

  const normalized = Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [key, normalizeArrayItems(value)])
  ) as JsonSchema

  if (normalized.type === 'array' && normalized.items === undefined) {
    normalized.items = {}
  }

  return normalized
}

export function createToolInputSchema(parameters: ZodTypeAny): Tool['inputSchema'] {
  return normalizeArrayItems(
    zodToJsonSchema(parameters, { target: 'openApi3' })
  ) as Tool['inputSchema']
}
