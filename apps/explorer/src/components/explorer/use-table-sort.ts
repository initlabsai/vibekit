'use client'

import { useState, useCallback } from 'react'

export interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

export function useTableSort<T>() {
  const [sort, setSort] = useState<SortState | null>(null)

  const onSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }, [])

  const sortData = useCallback(
    (items: T[], comparators: Record<string, (a: T, b: T) => number>): T[] => {
      if (!sort || !comparators[sort.key]) return items
      const cmp = comparators[sort.key]
      const sorted = [...items].sort(cmp)
      return sort.dir === 'desc' ? sorted.reverse() : sorted
    },
    [sort],
  )

  return { sort, onSort, sortData }
}
