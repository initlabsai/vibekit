import { formatAlgos, formatAssetAmount, formatTimestamp, txTypeLabel } from '@/lib/formatters'
import { CopyableAddress } from './copyable-address'
import { ArrowRightLeft } from 'lucide-react'

interface TransactionListProps {
  data: Record<string, unknown>
}

interface TxRow {
  id: string
  type: string
  sender: string
  receiver?: string
  paymentAmount?: number
  assetAmount?: number
  assetUnitName?: string
  assetDecimals?: number
  roundTime?: number
}

export function TransactionList({ data }: TransactionListProps) {
  const transactions = (data.transactions ?? []) as TxRow[]

  function getTxAmount(tx: TxRow): { amount: string; unit?: string } | null {
    if (tx.paymentAmount != null) return { amount: formatAlgos(tx.paymentAmount), unit: 'ALGO' }
    if (tx.assetAmount != null) {
      const amount = tx.assetDecimals != null
        ? formatAssetAmount(String(tx.assetAmount), tx.assetDecimals)
        : String(tx.assetAmount)
      return { amount, unit: tx.assetUnitName }
    }
    return null
  }

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-algo-border">
        <ArrowRightLeft className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">
          Transactions ({transactions.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-algo-muted border-b border-algo-border">
              <th className="text-left px-4 py-2 font-medium">TX ID</th>
              <th className="text-left px-4 py-2 font-medium">Type</th>
              <th className="text-left px-4 py-2 font-medium">From</th>
              <th className="text-left px-4 py-2 font-medium">To</th>
              <th className="text-right px-4 py-2 font-medium">Amount</th>
              <th className="text-right px-4 py-2 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
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
