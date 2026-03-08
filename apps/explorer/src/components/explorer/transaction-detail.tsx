import { formatAlgos, formatTimestamp, txTypeLabel } from '@/lib/formatters'
import { CopyableAddress } from './copyable-address'
import { CopyableValue } from './copyable-value'
import { FileText } from 'lucide-react'
import type { ReactNode } from 'react'

interface TransactionDetailProps {
  data: Record<string, unknown>
}

export function TransactionDetail({ data }: TransactionDetailProps) {
  return (
    <div className="rounded-lg border border-algo-border bg-algo-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">Transaction Detail</h3>
        <span className="ml-auto px-1.5 py-0.5 rounded bg-algo-dark text-xs text-algo-muted">
          {txTypeLabel(data.type as string)}
        </span>
      </div>
      <div className="space-y-2 text-xs">
        <Row label="TX ID" value={<CopyableAddress address={data.id as string} chars={12} />} />
        <Row label="Sender" value={<CopyableAddress address={data.sender as string} chars={58} />} />
        {data.receiver ? <Row label="Receiver" value={<CopyableAddress address={data.receiver as string} chars={58} />} /> : null}
        {data.paymentAmount != null && (
          <Row label="Amount" value={`${formatAlgos(data.paymentAmount as number)} ALGO`} />
        )}
        {data.assetId != null && <Row label="Asset ID" value={<CopyableValue value={String(data.assetId)}>{String(data.assetId)}</CopyableValue>} />}
        {data.assetAmount != null && (
          <Row label="Asset Amount" value={String(data.assetAmount)} />
        )}
        <Row label="Fee" value={`${formatAlgos(data.fee as number)} ALGO`} />
        {data.confirmedRound != null && (
          <Row label="Round" value={<CopyableValue value={String(data.confirmedRound)}>{String(data.confirmedRound)}</CopyableValue>} />
        )}
        {data.roundTime != null && (
          <Row label="Time" value={formatTimestamp(data.roundTime as number)} />
        )}
        {data.note ? <Row label="Note" value={data.note as string} /> : null}
        {data.group ? <Row label="Group" value={data.group as string} mono /> : null}
        {data.applicationId != null && (
          <Row label="App ID" value={<CopyableValue value={String(data.applicationId)}>{String(data.applicationId)}</CopyableValue>} />
        )}
        {Array.isArray(data.innerTxns) && data.innerTxns.length > 0 ? (
          <Row
            label="Inner Txns"
            value={`${data.innerTxns.length} inner transaction(s)`}
          />
        ) : null}
        {Array.isArray(data.logs) && data.logs.length > 0 ? (
          <div>
            <span className="text-algo-muted">Logs:</span>
            <pre className="mt-1 bg-algo-dark rounded p-2 text-[11px] overflow-x-auto max-h-32">
              {(data.logs as string[]).join('\n')}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1">
      <span className="text-algo-muted w-28 shrink-0">{label}</span>
      <span className={`break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
