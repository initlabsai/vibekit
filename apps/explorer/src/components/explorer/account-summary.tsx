import { formatAlgos, formatNumber } from '@/lib/formatters'
import { CopyableAddress } from './copyable-address'
import { Wallet, Coins, Layers, AppWindow } from 'lucide-react'

interface AccountSummaryProps {
  data: Record<string, unknown>
}

export function AccountSummary({ data }: AccountSummaryProps) {
  return (
    <div className="rounded-lg border border-algo-border bg-algo-card p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">Account</h3>
        {data.status ? (
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
              data.status === 'Online'
                ? 'bg-green-900/50 text-green-400'
                : 'bg-gray-800 text-algo-muted'
            }`}
          >
            {data.status as string}
          </span>
        ) : null}
      </div>
      <div className="text-xs text-algo-muted mb-3 break-all">
        <CopyableAddress address={data.address as string} chars={58} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Stat
          icon={<Coins className="w-3.5 h-3.5" />}
          label="Balance"
          value={`${formatAlgos(data.balanceAlgos as number)} ALGO`}
        />
        {data.totalAssetsOptedIn != null && (
          <Stat
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Assets"
            value={formatNumber(data.totalAssetsOptedIn as number)}
          />
        )}
        {data.totalAppsOptedIn != null && (
          <Stat
            icon={<AppWindow className="w-3.5 h-3.5" />}
            label="Apps"
            value={formatNumber(data.totalAppsOptedIn as number)}
          />
        )}
        {data.totalCreatedAssets != null && (
          <Stat
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Created Assets"
            value={formatNumber(data.totalCreatedAssets as number)}
          />
        )}
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-algo-dark rounded-md p-1.5 sm:p-2">
      <div className="flex items-center gap-1 text-algo-muted text-xs mb-1">
        {icon}
        {label}
      </div>
      <p className="text-xs sm:text-sm font-medium">{value}</p>
    </div>
  )
}
