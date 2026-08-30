'use client'

/** Card pieces shared across domains: value formatters, the sortable table, the paged-list footer. */
import algosdk from 'algosdk'
import { formatMicroAlgos } from '@initlabs/vibekit/views'
import { useState, type ReactNode } from 'react'

import { Button, FooterNote, InertContext } from './primitives'
import { filterRows, useTableSort, type SortValue } from './tables'

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Base64 bytes as an address when 32 bytes, as text when printable, else as they came. */
export function bytesDisplay(base64: string): string {
  try {
    const bytes = base64ToBytes(base64)
    if (bytes.length === 32) return algosdk.encodeAddress(bytes)
    const text = new TextDecoder().decode(bytes)
    return /^[^\p{C}]+$/u.test(text) ? text : base64
  } catch {
    return base64
  }
}

/** `1.5 ALGO`, or a dash when the field is absent. */
export function algo(value: number | string | undefined): string {
  return value === undefined ? '—' : `${formatMicroAlgos(value)} ALGO`
}

export interface Column<T> {
  key: string
  label: string
  cell: (row: T) => ReactNode
  /** Present on sortable columns. */
  sortValue?: (row: T) => SortValue
  align?: 'right'
  /** Grid track; defaults to a flexible column. */
  width?: string
}

/**
 * The density target: one grid row per record, sortable headers, a faint
 * filter over the current page. Rows with `onOpen` are touchable.
 */
export function Table<T>({
  columns,
  rows,
  keyOf,
  searchText,
  onOpen,
  filterable = rows.length > 5,
}: {
  columns: ReadonlyArray<Column<T>>
  rows: ReadonlyArray<T>
  keyOf: (row: T, index: number) => string
  /** What the filter searches for a row. */
  searchText: (row: T) => string
  onOpen?: (row: T) => void
  filterable?: boolean
}) {
  const [filter, setFilter] = useState('')
  const filtered = filterRows(rows, filter, searchText)
  const { sorted, sort, cycle } = useTableSort(filtered, (row, key) =>
    columns.find((column) => column.key === key)?.sortValue?.(row),
  )
  // Every track keeps a floor so narrow screens scroll the table instead of crushing a column.
  const template = columns.map((column) => column.width ?? 'minmax(7rem, 1fr)').join(' ')
  return (
    <div className="table-wrap">
      {filterable ? (
        <input
          className="table-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="filter…"
          aria-label="Filter rows on this page"
          autoComplete="off" autoCorrect="off" spellCheck={false} data-1p-ignore data-lpignore="true" data-form-type="other"
        />
      ) : null}
      <div className="table" role="table">
        <div className="tt-thead" role="row" style={{ gridTemplateColumns: template }}>
          {columns.map((column) =>
            column.sortValue ? (
              <button
                key={column.key}
                type="button"
                role="columnheader"
                className={`tt-sort${sort?.key === column.key ? ' on' : ''}${column.align === 'right' ? ' right' : ''}`}
                onClick={() => cycle(column.key)}
              >
                {column.label}
                {sort?.key === column.key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            ) : (
              <span key={column.key} role="columnheader" className={column.align === 'right' ? 'right' : undefined}>
                {column.label}
              </span>
            ),
          )}
        </div>
        {sorted.map((row, index) => (
          <div
            key={keyOf(row, index)}
            role="row"
            className={`tt-row${onOpen ? ' touchable' : ''}`}
            style={{ gridTemplateColumns: template }}
            onClick={onOpen ? () => onOpen(row) : undefined}
          >
            <InertContext.Provider value={onOpen !== undefined}>
              {columns.map((column) => (
                <span key={column.key} role="cell" className={column.align === 'right' ? 'right' : undefined}>
                  {column.cell(row)}
                </span>
              ))}
            </InertContext.Provider>
          </div>
        ))}
        {sorted.length === 0 && rows.length > 0 ? (
          <FooterNote text={`no rows match "${filter}" on this page`} />
        ) : null}
      </div>
    </div>
  )
}

/**
 * The bottom of a list card: a more ▸ button with the running count when the
 * record can fetch its next page, else a note that pages remain.
 */
export function MoreFooter({
  count,
  nextToken,
  onMore,
  loadingMore,
}: {
  count: number
  nextToken?: string
  onMore?: () => void
  loadingMore?: boolean
}) {
  if (!nextToken) return null
  if (!onMore) return <FooterNote text={`${count} shown · more pages remain`} />
  return (
    <div className="actions">
      <Button label={loadingMore ? 'loading…' : `more ▸ (${count} so far)`} disabled={loadingMore} onPress={onMore} />
    </div>
  )
}
