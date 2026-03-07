import { formatNumber, formatAssetAmount } from '@/lib/formatters'
import { CopyableAddress } from './copyable-address'
import { Gem } from 'lucide-react'
import type { ReactNode } from 'react'

interface AssetInfoProps {
  data: Record<string, unknown>
}

export function AssetInfo({ data }: AssetInfoProps) {
  const displaySupply = formatAssetAmount(
    data.totalSupply as string,
    data.decimals as number
  )

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Gem className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">
          {(data.name as string) ?? 'Asset'}
          {data.unitName ? ` (${data.unitName})` : ''}
        </h3>
        <span className="ml-auto text-xs text-algo-muted">ID: {data.assetId as number}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Field label="Total Supply" value={displaySupply} />
        <Field label="Decimals" value={String(data.decimals)} />
        <Field
          label="Creator"
          value={<CopyableAddress address={data.creator as string} />}
        />
        {data.manager ? (
          <Field label="Manager" value={<CopyableAddress address={data.manager as string} />} />
        ) : null}
        {data.reserve ? (
          <Field label="Reserve" value={<CopyableAddress address={data.reserve as string} />} />
        ) : null}
        {data.freeze ? (
          <Field label="Freeze" value={<CopyableAddress address={data.freeze as string} />} />
        ) : null}
        {data.clawback ? (
          <Field label="Clawback" value={<CopyableAddress address={data.clawback as string} />} />
        ) : null}
        {data.url ? <Field label="URL" value={data.url as string} /> : null}
        {data.defaultFrozen != null && (
          <Field label="Default Frozen" value={data.defaultFrozen ? 'Yes' : 'No'} />
        )}
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="bg-algo-dark rounded-md p-2">
      <div className="text-algo-muted text-[11px] mb-0.5">{label}</div>
      <div className={`text-sm ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}
