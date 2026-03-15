import { formatNumber } from '@/lib/formatters'
import { CopyableValue } from './copyable-value'
import { Gem } from 'lucide-react'

interface AssetCardProps {
  data: Record<string, unknown>
}

export function AssetCard({ data }: AssetCardProps) {
  const assetId = data.assetId as number
  const name = data.name as string | undefined
  const unitName = data.unitName as string | undefined
  const amount = data.amount as number | undefined
  const isFrozen = data.isFrozen as boolean | undefined

  const displayName = name || unitName || 'Unnamed'

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <Gem className="w-3.5 h-3.5 text-algo-teal shrink-0" />
        <span className="text-xs font-medium truncate">{displayName}</span>
        <CopyableValue value={String(assetId)}>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-algo-dark text-algo-muted shrink-0">
            #{formatNumber(assetId)}
          </span>
        </CopyableValue>
        {isFrozen && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-900/50 text-blue-400 shrink-0">
            Frozen
          </span>
        )}
      </div>
      {amount != null && <div className="text-xs text-algo-muted">{formatNumber(amount)}</div>}
    </div>
  )
}
