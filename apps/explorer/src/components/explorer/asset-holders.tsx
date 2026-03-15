'use client'

import { useState, useMemo } from 'react'
import { CopyableAddress } from './copyable-address'
import { Users } from 'lucide-react'
import { TableFilter } from './table-filter'
import { SortableHeader } from './sortable-header'
import { useTableSort } from './use-table-sort'

interface AssetHoldersProps {
  data: Record<string, unknown>
}

interface HolderRow {
  address: string
  amount: string
  isFrozen: boolean
}

export function AssetHolders({ data }: AssetHoldersProps) {
  const balances = (data.balances ?? []) as HolderRow[]
  const [filter, setFilter] = useState('')
  const { sort, onSort, sortData } = useTableSort<HolderRow>()

  const totalShown = useMemo(() => {
    return balances.reduce((sum, h) => sum + parseFloat(h.amount.replace(/,/g, '') || '0'), 0)
  }, [balances])

  const filtered = useMemo(() => {
    if (!filter) return balances
    const q = filter.toLowerCase()
    return balances.filter(
      (h) => h.address.toLowerCase().includes(q) || h.amount.toLowerCase().includes(q)
    )
  }, [balances, filter])

  const sorted = useMemo(
    () =>
      sortData(filtered, {
        amount: (a, b) =>
          parseFloat(a.amount.replace(/,/g, '') || '0') -
          parseFloat(b.amount.replace(/,/g, '') || '0'),
      }),
    [filtered, sortData]
  )

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-algo-border">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-algo-teal" />
          <h3 className="text-sm font-semibold text-algo-teal">
            Asset Holders ({filtered.length})
          </h3>
        </div>
        <TableFilter value={filter} onChange={setFilter} placeholder="Filter holders..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-algo-muted border-b border-algo-border">
              <th className="text-left px-4 py-2 font-medium">#</th>
              <th className="text-left px-4 py-2 font-medium">Address</th>
              <SortableHeader
                label="Amount"
                sortKey="amount"
                currentSort={sort}
                onSort={onSort}
                align="right"
              />
              <th className="text-right px-4 py-2 font-medium">% of shown</th>
              <th className="text-right px-4 py-2 font-medium">Frozen</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((holder, i) => (
              <tr
                key={holder.address}
                className="border-b border-algo-border/50 hover:bg-algo-dark/50"
              >
                <td className="px-4 py-2 text-algo-muted">{i + 1}</td>
                <td className="px-4 py-2">
                  <CopyableAddress address={holder.address} />
                </td>
                <td className="px-4 py-2 text-right font-mono">{holder.amount}</td>
                <td className="px-4 py-2 text-right">
                  {(() => {
                    if (totalShown === 0) return '—'
                    const pct =
                      (parseFloat(holder.amount.replace(/,/g, '') || '0') / totalShown) * 100
                    return (
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-12 h-1.5 rounded-full bg-algo-dark overflow-hidden">
                          <div
                            className="h-full rounded-full bg-algo-teal"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono">{pct < 0.01 ? '<0.01' : pct.toFixed(2)}%</span>
                      </div>
                    )
                  })()}
                </td>
                <td className="px-4 py-2 text-right">{holder.isFrozen ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
