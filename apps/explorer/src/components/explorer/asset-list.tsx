'use client'

import { useState, useMemo } from 'react'
import { CopyableValue } from './copyable-value'
import { Layers } from 'lucide-react'
import { TableFilter } from './table-filter'
import { SortableHeader } from './sortable-header'
import { useTableSort } from './use-table-sort'

interface AssetListProps {
  data: Record<string, unknown>
}

interface AssetRow {
  assetId: number
  amount?: string
  isFrozen?: boolean
  name?: string
  unitName?: string
}

export function AssetList({ data }: AssetListProps) {
  const assets = (data.assets ?? []) as AssetRow[]
  const [filter, setFilter] = useState('')
  const { sort, onSort, sortData } = useTableSort<AssetRow>()

  const filtered = useMemo(() => {
    if (!filter) return assets
    const q = filter.toLowerCase()
    return assets.filter((a) =>
      String(a.assetId).includes(q) ||
      a.name?.toLowerCase().includes(q) ||
      a.unitName?.toLowerCase().includes(q)
    )
  }, [assets, filter])

  const sorted = useMemo(
    () => sortData(filtered, {
      assetId: (a, b) => a.assetId - b.assetId,
      amount: (a, b) => parseFloat(a.amount?.replace(/,/g, '') ?? '0') - parseFloat(b.amount?.replace(/,/g, '') ?? '0'),
    }),
    [filtered, sortData],
  )

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-algo-border">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-algo-teal" />
          <h3 className="text-sm font-semibold text-algo-teal">Assets ({filtered.length})</h3>
        </div>
        <TableFilter value={filter} onChange={setFilter} placeholder="Filter assets..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-algo-muted border-b border-algo-border">
              <SortableHeader label="Asset ID" sortKey="assetId" currentSort={sort} onSort={onSort} />
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <SortableHeader label="Amount" sortKey="amount" currentSort={sort} onSort={onSort} align="right" />
              {sorted.some((a) => a.isFrozen !== undefined) && (
                <th className="text-right px-4 py-2 font-medium">Frozen</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((asset) => (
              <tr
                key={asset.assetId}
                className="border-b border-algo-border/50 hover:bg-algo-dark/50"
              >
                <td className="px-4 py-2 font-mono text-algo-teal">
                  <CopyableValue value={String(asset.assetId)}>{asset.assetId}</CopyableValue>
                </td>
                <td className="px-4 py-2">
                  {asset.name ?? asset.unitName ?? '\u2014'}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {asset.amount ?? '\u2014'}
                </td>
                {sorted.some((a) => a.isFrozen !== undefined) && (
                  <td className="px-4 py-2 text-right">
                    {asset.isFrozen !== undefined ? (asset.isFrozen ? 'Yes' : 'No') : '\u2014'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
