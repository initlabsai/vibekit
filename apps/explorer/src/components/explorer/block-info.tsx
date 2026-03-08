import { formatTimestamp, formatNumber } from '@/lib/formatters'
import { CopyableAddress } from './copyable-address'
import { CopyableValue } from './copyable-value'
import { Box } from 'lucide-react'
import type { ReactNode } from 'react'

interface BlockInfoProps {
  data: Record<string, unknown>
}

export function BlockInfo({ data }: BlockInfoProps) {
  return (
    <div className="rounded-lg border border-algo-border bg-algo-card p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        <Box className="w-4 h-4 text-algo-teal" />
        <CopyableValue value={String(data.round)}>
          <h3 className="text-sm font-semibold text-algo-teal">
            Block #{formatNumber(data.round as number)}
          </h3>
        </CopyableValue>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
        <Field label="Round" value={<CopyableValue value={String(data.round)}>{formatNumber(data.round as number)}</CopyableValue>} />
        <Field label="Timestamp" value={formatTimestamp(data.timestamp as number)} />
        <Field label="Transactions" value={formatNumber(data.transactionCount as number)} />
        {data.proposer ? (
          <Field label="Proposer" value={<CopyableAddress address={data.proposer as string} />} />
        ) : null}
        {data.previousBlockHash ? (
          <div className="col-span-2">
            <Field label="Previous Block Hash" value={data.previousBlockHash as string} mono />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="bg-algo-dark rounded-md p-1.5 sm:p-2">
      <div className="text-algo-muted text-[11px] mb-0.5">{label}</div>
      <div className={`text-xs sm:text-sm break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}
