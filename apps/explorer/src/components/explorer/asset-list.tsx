import { Layers } from 'lucide-react'

interface AssetListProps {
  data: Record<string, unknown>
}

interface AssetRow {
  assetId: number
  amount?: string
  isFrozen?: boolean
  name?: string
  unitName?: string
}

export function AssetList({ data }: AssetListProps) {
  const assets = (data.assets ?? []) as AssetRow[]

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-algo-border">
        <Layers className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">Assets ({assets.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-algo-muted border-b border-algo-border">
              <th className="text-left px-4 py-2 font-medium">Asset ID</th>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-right px-4 py-2 font-medium">Amount</th>
              {assets.some((a) => a.isFrozen !== undefined) && (
                <th className="text-right px-4 py-2 font-medium">Frozen</th>
              )}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr
                key={asset.assetId}
                className="border-b border-algo-border/50 hover:bg-algo-dark/50"
              >
                <td className="px-4 py-2 font-mono text-algo-teal">{asset.assetId}</td>
                <td className="px-4 py-2">
                  {asset.name ?? asset.unitName ?? '\u2014'}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {asset.amount ?? '\u2014'}
                </td>
                {assets.some((a) => a.isFrozen !== undefined) && (
                  <td className="px-4 py-2 text-right">
                    {asset.isFrozen !== undefined ? (asset.isFrozen ? 'Yes' : 'No') : '\u2014'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.nextToken ? (
        <div className="px-4 py-2 text-xs text-algo-muted border-t border-algo-border">
          More results available
        </div>
      ) : null}
    </div>
  )
}
