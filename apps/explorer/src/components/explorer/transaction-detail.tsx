import { formatAlgos, formatTimestamp, txTypeLabel } from '@/lib/formatters'
import { FileText } from 'lucide-react'

interface TransactionDetailProps {
  data: Record<string, unknown>
}

export function TransactionDetail({ data }: TransactionDetailProps) {
  return (
    <div className="rounded-lg border border-algo-border bg-algo-card p-4 my-3">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">Transaction Detail</h3>
        <span className="ml-auto px-1.5 py-0.5 rounded bg-algo-dark text-xs text-algo-muted">
          {txTypeLabel(data.type as string)}
        </span>
      </div>
      <div className="space-y-2 text-xs">
        <Row label="TX ID" value={data.id as string} mono />
        <Row label="Sender" value={data.sender as string} mono />
        {data.receiver ? <Row label="Receiver" value={data.receiver as string} mono /> : null}
        {data.paymentAmount != null && (
          <Row label="Amount" value={`${formatAlgos(data.paymentAmount as number)} ALGO`} />
        )}
        {data.assetId != null && <Row label="Asset ID" value={String(data.assetId)} />}
        {data.assetAmount != null && (
          <Row label="Asset Amount" value={String(data.assetAmount)} />
        )}
        <Row label="Fee" value={`${formatAlgos(data.fee as number)} ALGO`} />
        {data.confirmedRound != null && (
          <Row label="Round" value={String(data.confirmedRound)} />
        )}
        {data.roundTime != null && (
          <Row label="Time" value={formatTimestamp(data.roundTime as number)} />
        )}
        {data.note ? <Row label="Note" value={data.note as string} /> : null}
        {data.group ? <Row label="Group" value={data.group as string} mono /> : null}
        {data.applicationId != null && (
          <Row label="App ID" value={String(data.applicationId)} />
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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1">
      <span className="text-algo-muted w-28 shrink-0">{label}</span>
      <span className={`break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
