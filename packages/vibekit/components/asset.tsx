/** One asset from an `asset.detail` result, and the list from `asset.list`. */
import type { ViewData } from '@initlabs/vibekit/tools/views'

import { shorten } from './format'

export type AssetProps = { asset: ViewData<'asset.detail'>; className?: string }

export function Asset({ asset, className = '' }: AssetProps) {
  const facts: Array<[string, string | undefined]> = [
    ['supply', asset.totalSupplyApprox ? `${asset.totalSupplyScaled} (${asset.totalSupplyApprox})` : asset.totalSupplyScaled],
    ['decimals', String(asset.decimals)],
    ['creator', asset.creator],
    ['url', asset.url],
    ['frozen by default', asset.defaultFrozen ? 'yes' : undefined],
    ['clawback', asset.clawback],
  ]
  return (
    <section className={`vk-card vk-asset ${className}`} data-asset={asset.assetId}>
      <header className="vk-kicker">asset {asset.assetId}</header>
      <h3 className="vk-hero">
        {asset.name ?? `Asset ${asset.assetId}`}
        {asset.unitName ? <span className="vk-unit"> {asset.unitName}</span> : null}
      </h3>
      <dl className="vk-facts">
        {facts.map(([label, value]) =>
          value === undefined ? null : (
            <div key={label}>
              <dt>{label}</dt>
              <dd title={value}>{/^[A-Z2-7]{58}$/.test(value) ? shorten(value) : value}</dd>
            </div>
          ),
        )}
      </dl>
    </section>
  )
}

export type AssetListProps = {
  assets: ViewData<'asset.list'>['assets']
  /** Called with the asset when a row is chosen. */
  onOpen?: (asset: ViewData<'asset.detail'>) => void
  className?: string
}

export function AssetList({ assets, onOpen, className = '' }: AssetListProps) {
  return (
    <table className={`vk-table vk-asset-list ${className}`}>
      <thead>
        <tr>
          <th>id</th>
          <th>name</th>
          <th>unit</th>
          <th className="vk-num">supply</th>
        </tr>
      </thead>
      <tbody>
        {assets.map((asset) => (
          <tr key={asset.assetId} onClick={onOpen ? () => onOpen(asset) : undefined} className={onOpen ? 'vk-row-open' : undefined}>
            <td>{asset.assetId}</td>
            <td>{asset.name ?? '—'}</td>
            <td>{asset.unitName ?? '—'}</td>
            <td className="vk-num">{asset.totalSupplyApprox ?? asset.totalSupplyScaled}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
