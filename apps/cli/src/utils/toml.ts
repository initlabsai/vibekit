/**
 * Minimal TOML serializer for MCP config structures.
 *
 * Handles the subset of TOML needed for agent configs:
 * - String, number, boolean values
 * - Arrays of strings
 * - Nested object sections (up to 3 levels deep)
 */

import { dirname } from 'path'
import { ensureDir } from './files'
import { writeFile } from 'fs/promises'

function serializeValue(value: unknown): string {
  if (typeof value === 'string') return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.map(serializeValue).join(', ')}]`
  throw new Error(`Unsupported TOML value type: ${typeof value}`)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Serialize a config object to TOML format.
 *
 * Produces output like:
 * ```toml
 * [mcp_servers.kappa]
 * url = "https://example.com"
 *
 * [mcp_servers.vibekit-mcp]
 * command = "/path/to/vibekit"
 * args = ["mcp"]
 *
 * [mcp_servers.vibekit-mcp.env]
 * KEY = "value"
 * ```
 */
export function serializeToml(obj: Record<string, unknown>): string {
  const lines: string[] = []

  function writeSection(value: Record<string, unknown>, keyPath: string[]): void {
    // Separate inline values from nested objects
    const inlineEntries: [string, unknown][] = []
    const nestedEntries: [string, Record<string, unknown>][] = []

    for (const [k, v] of Object.entries(value)) {
      if (isPlainObject(v)) {
        nestedEntries.push([k, v])
      } else {
        inlineEntries.push([k, v])
      }
    }

    // Write section header + inline values if there are any inline values
    if (inlineEntries.length > 0) {
      if (keyPath.length > 0) {
        lines.push(`[${keyPath.join('.')}]`)
      }
      for (const [k, v] of inlineEntries) {
        lines.push(`${k} = ${serializeValue(v)}`)
      }
      lines.push('')
    }

    // Recurse into nested objects
    for (const [k, v] of nestedEntries) {
      writeSection(v, [...keyPath, k])
    }
  }

  writeSection(obj, [])

  return lines.join('\n')
}

/** Write a config object to a TOML file */
export async function writeTomlFile(filePath: string, data: Record<string, unknown>): Promise<void> {
  await ensureDir(dirname(filePath))
  await writeFile(filePath, serializeToml(data), 'utf-8')
}
