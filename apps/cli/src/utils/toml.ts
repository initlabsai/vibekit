/**
 * Minimal TOML serializer for MCP config structures (the subset agent configs need:
 * strings, numbers, booleans, string arrays, nested object sections).
 */

import { dirname } from 'path'
import { writeFile } from 'fs/promises'
import { ensureDir } from './files.js'

function serializeValue(value: unknown): string {
  if (typeof value === 'string') return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.map(serializeValue).join(', ')}]`
  throw new Error(`Unsupported TOML value type: ${typeof value}`)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function serializeToml(obj: Record<string, unknown>): string {
  const lines: string[] = []

  function writeSection(value: Record<string, unknown>, keyPath: string[]): void {
    const inlineEntries: [string, unknown][] = []
    const nestedEntries: [string, Record<string, unknown>][] = []

    for (const [k, v] of Object.entries(value)) {
      if (isPlainObject(v)) {
        nestedEntries.push([k, v])
      } else {
        inlineEntries.push([k, v])
      }
    }

    if (inlineEntries.length > 0) {
      if (keyPath.length > 0) {
        lines.push(`[${keyPath.join('.')}]`)
      }
      for (const [k, v] of inlineEntries) {
        lines.push(`${k} = ${serializeValue(v)}`)
      }
      lines.push('')
    }

    for (const [k, v] of nestedEntries) {
      writeSection(v, [...keyPath, k])
    }
  }

  writeSection(obj, [])
  return lines.join('\n')
}

export async function writeTomlFile(filePath: string, data: Record<string, unknown>): Promise<void> {
  await ensureDir(dirname(filePath))
  await writeFile(filePath, serializeToml(data), 'utf-8')
}
