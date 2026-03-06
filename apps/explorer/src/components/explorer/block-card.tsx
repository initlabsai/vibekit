import { formatTimestamp, formatNumber, truncateAddress } from '@/lib/formatters'
import { Box } from 'lucide-react'

interface BlockCardProps {
  data: Record<string, unknown>
}

export function BlockCard({ data }: BlockCardProps) {
  const round = data.round as number
  const timestamp = data.timestamp as number
  const transactionCount = data.transactionCount as number
  const proposer = data.proposer as string | undefined

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <Box className="w-3.5 h-3.5 text-algo-teal shrink-0" />
        <span className="text-xs font-medium text-algo-teal">
          Block #{formatNumber(round)}
        </span>
        <span className="text-[11px] text-algo-muted ml-auto">
          {formatNumber(transactionCount)} txns
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-algo-muted">
        <span>{formatTimestamp(timestamp)}</span>
        {proposer && (
          <span className="font-mono">{truncateAddress(proposer)}</span>
        )}
      </div>
    </div>
  )
}
