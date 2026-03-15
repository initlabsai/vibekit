'use client'

import { useState, useMemo } from 'react'
import { Globe } from 'lucide-react'
import { CopyableAddress } from './copyable-address'
import { TableFilter } from './table-filter'
import { SortableHeader } from './sortable-header'
import { useTableSort } from './use-table-sort'

interface NfdListProps {
  data: Record<string, unknown>
}

interface NfdRow {
  address: string
  name: string | null
  avatar?: string
}

export function NfdList({ data }: NfdListProps) {
  const results = (data.results ?? []) as NfdRow[]
  const [filter, setFilter] = useState('')
  const { sort, onSort, sortData } = useTableSort<NfdRow>()

  const filtered = useMemo(() => {
    if (!filter) return results
    const q = filter.toLowerCase()
    return results.filter(
      (r) => r.address.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q)
    )
  }, [results, filter])

  const sorted = useMemo(
    () =>
      sortData(filtered, {
        name: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
      }),
    [filtered, sortData]
  )

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-algo-border">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-algo-teal" />
          <h3 className="text-sm font-semibold text-algo-teal">NFD Names ({filtered.length})</h3>
        </div>
        <TableFilter value={filter} onChange={setFilter} placeholder="Filter names..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-algo-muted border-b border-algo-border">
              <th className="text-left px-4 py-2 font-medium">Address</th>
              <SortableHeader label="NFD Name" sortKey="name" currentSort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.address}
                className="border-b border-algo-border/50 hover:bg-algo-dark/50"
              >
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-2">
                    {row.avatar ? (
                      <img
                        src={row.avatar}
                        alt=""
                        className="w-5 h-5 rounded-full bg-algo-dark object-cover shrink-0"
                      />
                    ) : null}
                    <CopyableAddress address={row.address} />
                  </span>
                </td>
                <td className="px-4 py-2">
                  {row.name ?? <span className="text-algo-muted">{'\u2014'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
