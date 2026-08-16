/**
 * Display-hint render models — §4's `display` hints become terminal output.
 * Pure functions (no color, no JSX): the Ink components colorize the models,
 * and the string renderers stay for tests and non-Ink fallbacks.
 */

import type { DisplayHint } from '@initlabs/vibekit-core'

const MAX_ROWS = 15
const MAX_CELL = 28
const MAX_JSON_LINES = 24

export function cell(value: unknown): string {
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

export interface TableModel {
  columns: string[]
  /** Cell text per shown row, aligned with `columns`. */
  rows: string[][]
  /** Column widths (max of header and cells). */
  widths: number[]
  /** Rows hidden by truncation. */
  more: number
}

/** Rows of objects → an aligned-column model. */
export function tableModel(data: Array<Record<string, unknown>>): TableModel {
  const columns: string[] = []
  for (const row of data) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key)
    }
  }

  const shown = data.slice(0, MAX_ROWS)
  const rows = shown.map((row) => columns.map((column) => cell(row[column])))
  const widths = columns.map((column, i) =>
    Math.max(column.length, ...rows.map((row) => row[i]!.length)),
  )

  return { columns, rows, widths, more: Math.max(0, data.length - MAX_ROWS) }
}

/** Object → [key, value-text] entries (nested values inlined as JSON). */
export function kvEntries(data: Record<string, unknown>): Array<[string, string]> {
  return Object.keys(data).map((key) => {
    const value = data[key]
    const text = typeof value === 'object' && value !== null ? cell(value) : String(value ?? '')
    return [key, text]
  })
}

/** Find the array to tabulate: the value itself, or its single array property. */
export function tableRows(data: unknown): Array<Record<string, unknown>> | null {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>
  if (typeof data === 'object' && data !== null) {
    const arrays = Object.values(data).filter(Array.isArray)
    if (arrays.length === 1 && arrays[0]!.every((row) => typeof row === 'object' && row !== null)) {
      return arrays[0] as Array<Record<string, unknown>>
    }
  }
  return null
}

export function renderJson(data: unknown): string {
  const lines = JSON.stringify(data, null, 2)?.split('\n') ?? ['undefined']
  if (lines.length > MAX_JSON_LINES) {
    return [...lines.slice(0, MAX_JSON_LINES), `… ${lines.length - MAX_JSON_LINES} more lines`].join('\n')
  }
  return lines.join('\n')
}

// --- String renderers (tests + non-Ink fallbacks) ---

export function renderTable(data: Array<Record<string, unknown>>): string {
  if (data.length === 0) return '(no rows)'
  const model = tableModel(data)

  const grid = [model.columns, ...model.rows]
  const lines = grid.map((line) =>
    line.map((text, i) => text.padEnd(model.widths[i]!)).join('  ').trimEnd(),
  )
  lines.splice(1, 0, model.widths.map((w) => '─'.repeat(w)).join('  '))
  if (model.more > 0) {
    lines.push(`… ${model.more} more rows`)
  }
  return lines.join('\n')
}

export function renderKeyValue(data: Record<string, unknown>): string {
  const entries = kvEntries(data)
  if (entries.length === 0) return '(empty)'
  const width = Math.min(Math.max(...entries.map(([key]) => key.length)), 32)
  return entries.map(([key, text]) => `${key.padEnd(width)}  ${text}`).join('\n')
}

/** Render a tool result as plain text according to its display hint. */
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
