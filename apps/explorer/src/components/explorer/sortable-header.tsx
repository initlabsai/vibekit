'use client'

import { ChevronUp, ChevronDown } from 'lucide-react'
import type { SortState } from './use-table-sort'

interface SortableHeaderProps {
  label: string
  sortKey: string
  currentSort: SortState | null
  onSort: (key: string) => void
  align?: 'left' | 'right'
}

export function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  align = 'left',
}: SortableHeaderProps) {
  const active = currentSort?.key === sortKey
  const dir = active ? currentSort.dir : null

  return (
    <th
      className={`px-4 py-2 font-medium cursor-pointer select-none hover:text-algo-teal ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {dir === 'asc' && <ChevronUp className="w-3 h-3" />}
        {dir === 'desc' && <ChevronDown className="w-3 h-3" />}
      </span>
    </th>
  )
}
