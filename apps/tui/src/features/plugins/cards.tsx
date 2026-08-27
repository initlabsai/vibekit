/** Card per plugin view id. An id with no entry here renders raw — never crashes. */
import type { ReactNode } from 'react'

import type { NfdRecord } from '@initlabs/vibekit/plugins/nfd'
import type { AssetProfile } from '@initlabs/vibekit/plugins/pera'
import type { AssetPrices, RankedAssets } from '@initlabs/vibekit/plugins/vestige'

import type { OpenTarget } from '../../result-card.js'
import { MarketPricesCard, MarketRankedCard } from './market.js'
import { NfdCard } from './nfd.js'
import { PeraAssetCard } from './pera.js'

/** What a plugin card renders with; `data` is the schema-parsed wire. */
interface PluginCardProps {
  data: unknown
  network: string
  width: number
  onOpen: (target: OpenTarget) => void
}

export const PLUGIN_CARDS: Record<string, (props: PluginCardProps) => ReactNode> = {
  'nfd.profile': ({ data, network, width, onOpen }) => {
    const nfd = data as NfdRecord
    return (
      <NfdCard
        data={nfd}
        network={network}
        width={width}
        onOpenAccount={
          nfd.address ? () => onOpen({ kind: 'account', address: nfd.address! }) : undefined
        }
      />
    )
  },
  'vestige.prices': ({ data, network, width, onOpen }) => (
    <MarketPricesCard
      data={data as AssetPrices}
      network={network}
      width={width}
      onOpen={(assetId) => onOpen({ kind: 'asset', assetId })}
    />
  ),
  'vestige.markets': ({ data, network, width, onOpen }) => (
    <MarketRankedCard
      data={data as RankedAssets}
      network={network}
      width={width}
      onOpen={(assetId) => onOpen({ kind: 'asset', assetId })}
    />
  ),
  'pera.asset': ({ data, network, width, onOpen }) => (
    <PeraAssetCard
      data={data as AssetProfile}
      network={network}
      width={width}
      onOpen={(assetId) => onOpen({ kind: 'asset', assetId })}
    />
  ),
}
