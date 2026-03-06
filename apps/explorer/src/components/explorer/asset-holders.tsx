import { truncateAddress } from '@/lib/formatters'
import { Users } from 'lucide-react'

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

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-algo-border">
        <Users className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">
          Asset Holders ({balances.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-algo-muted border-b border-algo-border">
              <th className="text-left px-4 py-2 font-medium">#</th>
              <th className="text-left px-4 py-2 font-medium">Address</th>
              <th className="text-right px-4 py-2 font-medium">Amount</th>
              <th className="text-right px-4 py-2 font-medium">Frozen</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((holder, i) => (
              <tr
                key={holder.address}
                className="border-b border-algo-border/50 hover:bg-algo-dark/50"
              >
                <td className="px-4 py-2 text-algo-muted">{i + 1}</td>
                <td className="px-4 py-2 font-mono">{truncateAddress(holder.address)}</td>
                <td className="px-4 py-2 text-right font-mono">{holder.amount}</td>
                <td className="px-4 py-2 text-right">
                  {holder.isFrozen ? 'Yes' : 'No'}
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
