'use client'

import { useState, useMemo } from 'react'
import { formatAlgos, formatTimestamp, txTypeLabel } from '@/lib/formatters'
import { CopyableAddress } from './copyable-address'
import { ArrowRightLeft, ArrowUp, ArrowDown } from 'lucide-react'
import { TableFilter } from './table-filter'
import { SortableHeader } from './sortable-header'
import { useTableSort } from './use-table-sort'

interface TransactionListProps {
  data: Record<string, unknown>
}

interface TxRow {
  id: string
  type: string
  sender: string
  receiver?: string
  paymentAmount?: number
  assetAmount?: number | string
  assetUnitName?: string
  assetDecimals?: number
  roundTime?: number
}

function DirectionBadge({ tx, address }: { tx: TxRow; address?: string }) {
  if (!address) return null
  const isSender = tx.sender === address
  const isReceiver = tx.receiver === address
  if (isSender && isReceiver) return <span className="px-1.5 py-0.5 rounded bg-algo-dark text-algo-muted text-[10px]">Self</span>
  if (isSender) return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px]"><ArrowUp className="w-3 h-3" />Sent</span>
  if (isReceiver) return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px]"><ArrowDown className="w-3 h-3" />Received</span>
  return null
}

export function TransactionList({ data }: TransactionListProps) {
  const transactions = (data.transactions ?? []) as TxRow[]
  const address = data.address as string | undefined
  const [filter, setFilter] = useState('')
  const { sort, onSort, sortData } = useTableSort<TxRow>()

  const filtered = useMemo(() => {
    if (!filter) return transactions
    const q = filter.toLowerCase()
    return transactions.filter((tx) =>
      tx.id.toLowerCase().includes(q) ||
      txTypeLabel(tx.type).toLowerCase().includes(q) ||
      tx.sender.toLowerCase().includes(q) ||
      tx.receiver?.toLowerCase().includes(q)
    )
  }, [transactions, filter])

  const sorted = useMemo(
    () => sortData(filtered, {
      amount: (a, b) => {
        const parse = (v: number | string | undefined) => typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : (v ?? 0)
        return parse(a.paymentAmount ?? a.assetAmount) - parse(b.paymentAmount ?? b.assetAmount)
      },
      time: (a, b) => (a.roundTime ?? 0) - (b.roundTime ?? 0),
    }),
    [filtered, sortData],
  )

  function getTxAmount(tx: TxRow): { amount: string; unit?: string } | null {
    if (tx.paymentAmount != null) return { amount: formatAlgos(tx.paymentAmount), unit: 'ALGO' }
    if (tx.assetAmount != null) {
      return { amount: String(tx.assetAmount), unit: tx.assetUnitName }
    }
    return null
  }

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-algo-border">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-algo-teal" />
          <h3 className="text-sm font-semibold text-algo-teal">
            Transactions ({filtered.length})
          </h3>
        </div>
        <TableFilter value={filter} onChange={setFilter} placeholder="Filter transactions..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-algo-muted border-b border-algo-border">
              <th className="text-left px-4 py-2 font-medium">TX ID</th>
              <th className="text-left px-4 py-2 font-medium">Type</th>
              {address && <th className="text-left px-4 py-2 font-medium">Direction</th>}
              <th className="text-left px-4 py-2 font-medium">From</th>
              <th className="text-left px-4 py-2 font-medium">To</th>
              <SortableHeader label="Amount" sortKey="amount" currentSort={sort} onSort={onSort} align="right" />
              <SortableHeader label="Time" sortKey="time" currentSort={sort} onSort={onSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((tx) => (
              <tr
                key={tx.id}
                className="border-b border-algo-border/50 hover:bg-algo-dark/50"
              >
                <td className="px-4 py-2 text-algo-teal">
                  <CopyableAddress address={tx.id} chars={8} />
                </td>
                <td className="px-4 py-2">
                  <span className="px-1.5 py-0.5 rounded bg-algo-dark text-algo-muted">
                    {txTypeLabel(tx.type)}
                  </span>
                </td>
                {address && (
                  <td className="px-4 py-2">
                    <DirectionBadge tx={tx} address={address} />
                  </td>
                )}
                <td className="px-4 py-2">
                  <CopyableAddress address={tx.sender} />
                </td>
                <td className="px-4 py-2">
                  {tx.receiver ? <CopyableAddress address={tx.receiver} /> : '\u2014'}
                </td>
                <td className="px-4 py-2 text-right">
                  {(() => {
                    const info = getTxAmount(tx)
                    if (!info) return '\u2014'
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        {info.amount}
                        {info.unit && (
                          <span className="px-1.5 py-0.5 rounded bg-algo-dark text-algo-muted text-[10px] font-medium">
                            {info.unit}
                          </span>
                        )}
                      </span>
                    )
                  })()}
                </td>
                <td className="px-4 py-2 text-right text-algo-muted">
                  {tx.roundTime ? formatTimestamp(tx.roundTime) : '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
