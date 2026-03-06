import { formatAlgos, truncateAddress, formatTimestamp, txTypeLabel } from '@/lib/formatters'
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
  roundTime?: number
}

export function TransactionList({ data }: TransactionListProps) {
  const transactions = (data.transactions ?? []) as TxRow[]

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
                <td className="px-4 py-2 font-mono text-algo-teal">
                  {truncateAddress(tx.id, 8)}
                </td>
                <td className="px-4 py-2">
                  <span className="px-1.5 py-0.5 rounded bg-algo-dark text-algo-muted">
                    {txTypeLabel(tx.type)}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono">{truncateAddress(tx.sender)}</td>
                <td className="px-4 py-2 font-mono">
                  {tx.receiver ? truncateAddress(tx.receiver) : '\u2014'}
                </td>
                <td className="px-4 py-2 text-right">
                  {tx.paymentAmount != null
                    ? `${formatAlgos(tx.paymentAmount)} ALGO`
                    : tx.assetAmount != null
                      ? String(tx.assetAmount)
                      : '\u2014'}
                </td>
                <td className="px-4 py-2 text-right text-algo-muted">
                  {tx.roundTime ? formatTimestamp(tx.roundTime) : '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.nextToken ? (
        <div className="px-4 py-2 text-xs text-algo-muted border-t border-algo-border">
          More results available
        </div>
      ) : null}
    </div>
  )
}
