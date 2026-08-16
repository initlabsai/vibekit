/**
 * Display-hint renderers — §4's `display` hints become terminal output here.
 * Pure functions (no color): the REPL applies styling.
 */

import type { DisplayHint } from '@initlabs/vibekit-core'

const MAX_ROWS = 15
const MAX_CELL = 28
const MAX_JSON_LINES = 24

function cell(value: unknown): string {
  let text: string
  if (value === null || value === undefined) {
    text = ''
  } else if (typeof value === 'object') {
    text = JSON.stringify(value)
  } else {
    text = String(value)
  }
  return text.length > MAX_CELL ? text.slice(0, MAX_CELL - 1) + '…' : text
}

/** Rows of objects → aligned columns. */
export function renderTable(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '(no rows)'

  const columns: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key)
    }
  }

  const shown = rows.slice(0, MAX_ROWS)
  const grid = [columns, ...shown.map((row) => columns.map((column) => cell(row[column])))]
  const widths = columns.map((_, i) => Math.max(...grid.map((line) => line[i]!.length)))

  const lines = grid.map((line) => line.map((text, i) => text.padEnd(widths[i]!)).join('  ').trimEnd())
  lines.splice(1, 0, widths.map((w) => '─'.repeat(w)).join('  '))
  if (rows.length > MAX_ROWS) {
    lines.push(`… ${rows.length - MAX_ROWS} more rows`)
  }
  return lines.join('\n')
}

/** Object → key/value listing (nested values inlined as JSON). */
export function renderKeyValue(data: Record<string, unknown>): string {
  const keys = Object.keys(data)
  if (keys.length === 0) return '(empty)'
  const width = Math.min(Math.max(...keys.map((k) => k.length)), 32)
  return keys
    .map((key) => {
      const value = data[key]
      const text =
        typeof value === 'object' && value !== null ? cell(value) : String(value ?? '')
      return `${key.padEnd(width)}  ${text}`
    })
    .join('\n')
}

function renderJson(data: unknown): string {
  const lines = JSON.stringify(data, null, 2)?.split('\n') ?? ['undefined']
  if (lines.length > MAX_JSON_LINES) {
    return [...lines.slice(0, MAX_JSON_LINES), `… ${lines.length - MAX_JSON_LINES} more lines`].join('\n')
  }
  return lines.join('\n')
}

/** Find the array to tabulate: the value itself, or its single array property. */
function tableRows(data: unknown): Array<Record<string, unknown>> | null {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>
  if (typeof data === 'object' && data !== null) {
    const arrays = Object.values(data).filter(Array.isArray)
    if (arrays.length === 1 && arrays[0]!.every((row) => typeof row === 'object' && row !== null)) {
      return arrays[0] as Array<Record<string, unknown>>
    }
  }
  return null
}

/** Render a tool result for the terminal according to its display hint. */
export function renderToolResult(output: unknown, display?: DisplayHint): string {
  switch (display) {
    case 'table': {
      const rows = tableRows(output)
      return rows ? renderTable(rows) : renderJson(output)
    }
    case 'account':
    case 'asset':
    case 'txn':
      if (typeof output === 'object' && output !== null && !Array.isArray(output)) {
        return renderKeyValue(output as Record<string, unknown>)
      }
      return renderJson(output)
    case 'markdown':
      return typeof output === 'string' ? output : renderJson(output)
    case 'json':
    default:
      return renderJson(output)
  }
}
