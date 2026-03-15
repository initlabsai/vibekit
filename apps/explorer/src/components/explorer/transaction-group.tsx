import { formatAlgos, formatTimestamp, txTypeLabel } from '@/lib/formatters'
import { CopyableAddress } from './copyable-address'
import { CopyableValue } from './copyable-value'
import { Layers } from 'lucide-react'

interface TransactionGroupProps {
  data: Record<string, unknown>
}

function TxnCard({ txn, depth = 0 }: { txn: Record<string, unknown>; depth?: number }) {
  const innerTxns = Array.isArray(txn.innerTxns) ? (txn.innerTxns as Record<string, unknown>[]) : []

  return (
    <div
      className={`rounded-md border border-algo-border p-3 text-xs space-y-1.5 ${depth === 0 ? 'bg-algo-dark' : 'bg-algo-card/50'}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-algo-card text-algo-muted text-[10px] font-medium">
          {txTypeLabel(txn.type as string)}
        </span>
        {typeof txn.id === 'string' && <CopyableAddress address={txn.id} chars={8} />}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {typeof txn.sender === 'string' && <CopyableAddress address={txn.sender} chars={6} />}
        {typeof txn.receiver === 'string' && (
          <>
            <span className="text-algo-muted">→</span>
            <CopyableAddress address={txn.receiver} chars={6} />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-algo-muted">
        {txn.paymentAmount != null && <span>{formatAlgos(txn.paymentAmount as number)} ALGO</span>}
        {txn.assetAmount != null && (
          <span>
            {String(txn.assetAmount)}
            {txn.assetUnitName ? ` ${txn.assetUnitName}` : ''}
          </span>
        )}
        {txn.applicationId != null && <span>App: {String(txn.applicationId)}</span>}
      </div>

      {innerTxns.length > 0 && (
        <div className="mt-2 ml-2 pl-3 border-l border-algo-border/50 space-y-2">
          <div className="text-[10px] text-algo-muted">
            {innerTxns.length} inner transaction{innerTxns.length > 1 ? 's' : ''}
          </div>
          {innerTxns.map((inner, j) => (
            <TxnCard key={j} txn={inner} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function TxnStep({
  txn,
  label,
  isLast,
  depth = 0,
}: {
  txn: Record<string, unknown>
  label: string
  isLast: boolean
  depth?: number
}) {
  const isInner = depth > 0
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        {isInner ? (
          <div className="w-5 h-5 flex items-center justify-center text-[9px] font-mono text-algo-muted shrink-0">
            {label}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-algo-dark border border-algo-border flex items-center justify-center text-[10px] font-semibold text-algo-teal shrink-0">
            {label}
          </div>
        )}
        {!isLast && <div className="w-px flex-1 bg-algo-border" />}
      </div>
      <div className="flex-1 mb-2">
        <TxnCard txn={txn} depth={depth} />
      </div>
    </div>
  )
}

export function TransactionGroup({ data }: TransactionGroupProps) {
  const txns = (data.transactions ?? []) as Record<string, unknown>[]
  const firstTxn = txns[0]
  const groupId = firstTxn?.group as string | undefined
  const totalFees = txns.reduce((sum, t) => sum + ((t.fee as number) ?? 0), 0)

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">
          Atomic Group ({txns.length} transactions)
        </h3>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-algo-muted mb-4 px-1">
        {groupId && (
          <span>
            Group: <CopyableValue value={groupId}>{groupId.slice(0, 8)}…</CopyableValue>
          </span>
        )}
        <span>Total fees: {formatAlgos(totalFees)} ALGO</span>
        {firstTxn?.confirmedRound != null && <span>Round: {String(firstTxn.confirmedRound)}</span>}
        {firstTxn?.roundTime != null && (
          <span>{formatTimestamp(firstTxn.roundTime as number)}</span>
        )}
      </div>

      {/* Transaction steps */}
      <div className="relative space-y-0">
        {txns.map((txn, i) => (
          <TxnStep key={i} txn={txn} label={String(i + 1)} isLast={i === txns.length - 1} />
        ))}
      </div>
    </div>
  )
}
