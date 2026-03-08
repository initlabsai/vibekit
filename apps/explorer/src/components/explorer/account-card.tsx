import { formatAlgos, formatNumber } from '@/lib/formatters'
import { CopyableAddress } from './copyable-address'
import { Wallet } from 'lucide-react'

interface AccountCardProps {
  data: Record<string, unknown>
}

export function AccountCard({ data }: AccountCardProps) {
  const address = data.address as string
  const balanceAlgos = data.balanceAlgos as number
  const status = data.status as string | undefined
  const totalAssetsOptedIn = data.totalAssetsOptedIn as number | undefined
  const totalAppsOptedIn = data.totalAppsOptedIn as number | undefined
  const totalCreatedAssets = data.totalCreatedAssets as number | undefined
  const createdAtRound = data.createdAtRound as number | undefined

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <Wallet className="w-3.5 h-3.5 text-algo-teal shrink-0" />
        <span className="text-xs text-algo-teal truncate"><CopyableAddress address={address} /></span>
        {status && (
          <span
            className={`ml-auto text-[11px] px-1.5 py-0.5 rounded-full shrink-0 ${
              status === 'Online'
                ? 'bg-green-900/50 text-green-400'
                : 'bg-gray-800 text-algo-muted'
            }`}
          >
            {status}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-3 text-xs">
        <span className="font-medium">{formatAlgos(balanceAlgos)} ALGO</span>
        <span className="text-algo-muted flex gap-2">
          {totalAssetsOptedIn != null && totalAssetsOptedIn > 0 && (
            <span>{formatNumber(totalAssetsOptedIn)} assets</span>
          )}
          {totalAppsOptedIn != null && totalAppsOptedIn > 0 && (
            <span>{formatNumber(totalAppsOptedIn)} apps</span>
          )}
          {totalCreatedAssets != null && totalCreatedAssets > 0 && (
            <span>{formatNumber(totalCreatedAssets)} created</span>
          )}
          {createdAtRound != null && (
            <span>Created round {formatNumber(createdAtRound)}</span>
          )}
        </span>
      </div>
    </div>
  )
}
