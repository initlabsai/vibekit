import { formatAlgos, formatTimestamp, txTypeLabel } from '@/lib/formatters'
import { CopyableAddress } from './copyable-address'
import { ArrowRightLeft } from 'lucide-react'

interface TransactionCardProps {
  data: Record<string, unknown>
}

export function TransactionCard({ data }: TransactionCardProps) {
  const id = data.id as string
  const type = data.type as string
  const sender = data.sender as string
  const receiver = data.receiver as string | undefined
  const paymentAmount = data.paymentAmount as number | undefined
  const assetAmount = data.assetAmount as number | undefined
  const roundTime = data.roundTime as number | undefined

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <ArrowRightLeft className="w-3.5 h-3.5 text-algo-teal shrink-0" />
        <span className="px-1.5 py-0.5 rounded bg-algo-dark text-algo-muted text-[11px]">
          {txTypeLabel(type)}
        </span>
        <span className="ml-auto text-xs text-algo-teal truncate">
          <CopyableAddress address={id} chars={8} />
        </span>
      </div>
      <div className="text-xs">
        <CopyableAddress address={sender} />
        {receiver && (
          <>
            <span className="text-algo-muted mx-1">&rarr;</span>
            <CopyableAddress address={receiver} />
          </>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs mt-1">
        {paymentAmount != null && (
          <span className="font-medium">{formatAlgos(paymentAmount)} ALGO</span>
        )}
        {assetAmount != null && paymentAmount == null && (
          <span className="font-medium">{String(assetAmount)}</span>
        )}
        {roundTime && <span className="text-algo-muted ml-auto">{formatTimestamp(roundTime)}</span>}
      </div>
    </div>
  )
}
