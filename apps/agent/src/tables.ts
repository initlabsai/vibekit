/** Client-side sort and filter over the current page of view-model rows. No query protocol. */
import { useMemo, useState } from 'react'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: string
  direction: SortDirection
}

export type SortValue = number | bigint | string | undefined

function compare(a: SortValue, b: SortValue): number {
  if (a === undefined) return b === undefined ? 0 : 1
  if (b === undefined) return -1
  if (typeof a === 'string' || typeof b === 'string') return String(a).localeCompare(String(b))
  return a < b ? -1 : a > b ? 1 : 0
}

/** Header click cycles none → asc → desc → none on one key; another key starts at asc. */
export function nextSort(current: SortState | null, key: string): SortState | null {
  if (current?.key !== key) return { key, direction: 'asc' }
  return current.direction === 'asc' ? { key, direction: 'desc' } : null
}

export function useTableSort<T>(
  rows: ReadonlyArray<T>,
  sortValue: (row: T, key: string) => SortValue,
) {
  const [sort, setSort] = useState<SortState | null>(null)
  const sorted = useMemo(() => {
    if (!sort) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const left = sortValue(a, sort.key)
      const right = sortValue(b, sort.key)
      // Rows without a value sink to the bottom in both directions.
      if (left === undefined || right === undefined) return compare(left, right)
      const order = compare(left, right)
      return sort.direction === 'asc' ? order : -order
    })
    return copy
  }, [rows, sort, sortValue])
  return { sorted, sort, cycle: (key: string) => setSort((current) => nextSort(current, key)) }
}

/** Rows whose searchable text contains every word of the filter, case-insensitively. */
export function filterRows<T>(
  rows: ReadonlyArray<T>,
  filter: string,
  text: (row: T) => string,
): ReadonlyArray<T> {
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return rows
  return rows.filter((row) => {
    const haystack = text(row).toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}
