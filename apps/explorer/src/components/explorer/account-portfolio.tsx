'use client'

import { useState, useMemo } from 'react'
import { PieChart, Coins } from 'lucide-react'
import { formatAlgos, formatUsd } from '@/lib/formatters'
import { CopyableAddress } from './copyable-address'
import { CopyableValue } from './copyable-value'
import { AssetLogo } from './asset-logo'
import { VerificationBadge } from './verification-badge'
import { TableFilter } from './table-filter'

interface PortfolioAsset {
  assetId: number
  name?: string
  unitName?: string
  amount: string
  logo: string | null
  verificationTier: 'verified' | 'trusted' | 'suspicious' | 'unverified'
  usdValue: number | null
}

interface AccountPortfolioProps {
  data: Record<string, unknown>
}

export function AccountPortfolio({ data }: AccountPortfolioProps) {
  const address = data.address as string
  const algoBalance = data.algoBalance as number
  const algoUsdValue = data.algoUsdValue as number | null
  const totalValueUsd = data.totalValueUsd as number
  const assets = (data.assets ?? []) as PortfolioAsset[]
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    if (!filter) return assets
    const q = filter.toLowerCase()
    return assets.filter(
      (a) =>
        String(a.assetId).includes(q) ||
        a.name?.toLowerCase().includes(q) ||
        a.unitName?.toLowerCase().includes(q),
    )
  }, [assets, filter])

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      <div className="px-4 py-3 border-b border-algo-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-algo-teal" />
            <h3 className="text-sm font-semibold text-algo-teal">Portfolio</h3>
            {totalValueUsd > 0 && (
              <span className="text-sm font-semibold text-algo-teal">
                {formatUsd(totalValueUsd)}
              </span>
            )}
          </div>
          <TableFilter value={filter} onChange={setFilter} placeholder="Filter assets..." />
        </div>
        <div className="text-xs text-algo-muted">
          <CopyableAddress address={address} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-algo-muted border-b border-algo-border">
              <th className="text-left px-4 py-2 font-medium">Asset</th>
              <th className="text-right px-4 py-2 font-medium">Balance</th>
              <th className="text-right px-4 py-2 font-medium">USD Value</th>
            </tr>
          </thead>
          <tbody>
            {/* ALGO row */}
            <tr className="border-b border-algo-border/50 hover:bg-algo-dark/50">
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-algo-teal" />
                  <span className="font-medium">ALGO</span>
                </div>
              </td>
              <td className="px-4 py-2 text-right font-mono">
                {formatAlgos(algoBalance)}
              </td>
              <td className="px-4 py-2 text-right font-mono">
                {algoUsdValue != null ? formatUsd(algoUsdValue) : '—'}
              </td>
            </tr>

            {filtered.map((asset) => (
              <tr
                key={asset.assetId}
                className="border-b border-algo-border/50 hover:bg-algo-dark/50"
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <AssetLogo
                      src={asset.logo}
                      name={asset.name ?? asset.unitName}
                      size={20}
                    />
                    <span className="font-medium">
                      {asset.name ?? asset.unitName ?? 'Unknown'}
                    </span>
                    {asset.unitName && asset.name && (
                      <span className="text-algo-muted">{asset.unitName}</span>
                    )}
                    <VerificationBadge tier={asset.verificationTier} />
                    <CopyableValue value={String(asset.assetId)}>
                      <span className="text-algo-muted">#{asset.assetId}</span>
                    </CopyableValue>
                  </div>
                </td>
                <td className="px-4 py-2 text-right font-mono">{asset.amount}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {asset.usdValue != null ? formatUsd(asset.usdValue) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
