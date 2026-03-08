'use client'

import { Search } from 'lucide-react'

interface TableFilterProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function TableFilter({ value, onChange, placeholder = 'Filter...' }: TableFilterProps) {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-algo-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 w-40 rounded border border-algo-border bg-algo-dark pl-7 pr-2 text-xs text-algo-text placeholder:text-algo-muted focus:border-algo-teal focus:outline-none"
      />
    </div>
  )
}
